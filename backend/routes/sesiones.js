const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendPackLowAlert, sendSessionConfirmation, sendSessionRescheduled, sendSessionRequestAck, sendSessionRequestToAdmin, sendSessionRequestResult } = require('../services/emailService');
const { audit } = require('../services/auditLog');
const { buildSessionICS } = require('../services/icsService');
const { bloquesOcupados } = require('../services/externalCalendarService');
const { FECHA_NAIVE_RE, naiveToMs, msToNaive, ahoraParedMs, diaSemana } = require('../services/fechaPared');
const { HORA_INICIO, HORA_FIN, DIAS_LABORALES, ANTELACION_MINIMA_HORAS } = require('../config/horario');
const meet = require('../services/googleMeetService');

const router = express.Router();

// El enlace lo abre el paciente desde su panel y sus emails: solo https válido.
function enlaceValido(url) {
  try {
    return new URL(String(url)).protocol === 'https:';
  } catch {
    return false;
  }
}

// Precio (en céntimos) de una tarifa activa por código, o null si no existe.
// Se usa para prefijar el precio de una sesión suelta al crearla.
async function tarifaPrecio(codigo) {
  const { data } = await supabase
    .from('tarifas')
    .select('precio_cents')
    .eq('codigo', codigo)
    .eq('activa', true)
    .limit(1);
  return data?.[0]?.precio_cents ?? null;
}

// Genera enlaces de Meet para las sesiones de videollamada que no traen enlace
// manual y actualiza las filas (muta cada sesión in situ para que la respuesta
// y los emails ya salgan con el enlace). Best-effort: si Google falla o la
// cuenta no está conectada, las sesiones quedan sin enlace y se añade a mano.
async function generarEnlacesMeet(sesiones) {
  for (const s of sesiones) {
    if (s.tipo !== 'videollamada' || s.enlace_videollamada) continue;
    try {
      const resultado = await meet.crearEventoMeet(s.fecha_hora, s.duracion_minutos);
      if (!resultado) return; // cuenta no conectada: no insistir con el resto
      const { error } = await supabase
        .from('sesiones')
        .update({ enlace_videollamada: resultado.enlace, google_event_id: resultado.eventId, updated_at: new Date().toISOString() })
        .eq('id', s.id);
      if (error) throw new Error(error.message);
      s.enlace_videollamada = resultado.enlace;
      s.google_event_id = resultado.eventId;
    } catch (err) {
      console.error('[meet] generar enlace:', err.message);
    }
  }
}

// Devuelve el conflicto que se solapa con [fecha_hora, fecha_hora + duración), o null.
// Comprueba sesiones programadas/solicitadas y, si los hay, los bloques de los
// calendarios externos de Andrea (fail-open: si Google no responde, no bloquea).
// La ventana de búsqueda arranca 4h antes para capturar sesiones largas aún en curso.
async function checkSolape(fechaHora, duracionMinutos, excludeId = null, { incluirExternos = true } = {}) {
  const inicio = naiveToMs(fechaHora);
  const fin = inicio + duracionMinutos * 60000;

  let query = supabase
    .from('sesiones')
    .select('id, fecha_hora, duracion_minutos, pacientes ( users ( nombre_completo ) )')
    .in('estado', ['programada', 'solicitada'])
    .gte('fecha_hora', msToNaive(inicio - 4 * 3600000))
    .lt('fecha_hora', msToNaive(fin));

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const conflicto = (data || []).find((s) => {
    const sInicio = naiveToMs(s.fecha_hora);
    const sFin = sInicio + (s.duracion_minutos || 50) * 60000;
    return sInicio < fin && sFin > inicio;
  });

  if (conflicto) {
    return {
      id: conflicto.id,
      fecha_hora: conflicto.fecha_hora,
      duracion_minutos: conflicto.duracion_minutos,
      paciente_nombre: conflicto.pacientes?.users?.nombre_completo || '—',
    };
  }

  if (incluirExternos) {
    try {
      const bloques = await bloquesOcupados(msToNaive(inicio - 4 * 3600000), msToNaive(fin));
      const ocupado = bloques.find((b) => naiveToMs(b.inicio) < fin && naiveToMs(b.fin) > inicio);
      if (ocupado) {
        return {
          id: null,
          fecha_hora: ocupado.inicio,
          duracion_minutos: Math.round((naiveToMs(ocupado.fin) - naiveToMs(ocupado.inicio)) / 60000),
          paciente_nombre: ocupado.titulo,
          externo: true,
        };
      }
    } catch (err) {
      console.error('[checkSolape] calendarios externos:', err.message);
    }
  }

  return null;
}

// Admin: crear sesión para un paciente.
// Con `repeticiones` > 1 crea una serie (semanal: intervalo_dias=7, quincenal: 14).
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { paciente_id, pack_id, fecha_hora, tipo, duracion_minutos, enlace_videollamada, force } = req.body;
  if (!paciente_id || !fecha_hora || !tipo) {
    return res.status(400).json({ error: 'paciente_id, fecha_hora y tipo son obligatorios' });
  }
  if (!FECHA_NAIVE_RE.test(String(fecha_hora))) {
    return res.status(400).json({ error: 'fecha_hora debe tener formato YYYY-MM-DDTHH:MM' });
  }
  if (enlace_videollamada && !enlaceValido(enlace_videollamada)) {
    return res.status(400).json({ error: 'El enlace debe ser una URL https válida' });
  }
  const repeticiones = Math.min(Math.max(parseInt(req.body.repeticiones) || 1, 1), 20);
  const intervaloDias = parseInt(req.body.intervalo_dias) === 14 ? 14 : 7;

  try {
    const duracion = duracion_minutos || 50;
    // En espacio de pared ficticio-UTC no hay DST: sumar días conserva la hora
    const fechas = Array.from({ length: repeticiones }, (_, k) =>
      msToNaive(naiveToMs(fecha_hora) + k * intervaloDias * 86400000)
    );

    // Sesión suelta (sin pack): nace 'no_pagado' con su precio, para poder
    // registrar el cobro. El precio llega del formulario o se prefija de tarifa.
    const sinPack = !pack_id;
    const precioBody = parseInt(req.body.precio_cents);
    const precioSuelta = sinPack
      ? (Number.isFinite(precioBody) ? precioBody : await tarifaPrecio('sesion_individual'))
      : null;

    if (!force) {
      const conflictos = [];
      for (const f of fechas) {
        const solape = await checkSolape(f, duracion);
        if (solape) conflictos.push({ fecha_hora: f, solapa_con: solape });
      }
      if (conflictos.length > 0) {
        return res.status(409).json({ error: 'solape', solapa_con: conflictos[0].solapa_con, conflictos });
      }
    }

    const filas = fechas.map((f) => ({
      paciente_id,
      pack_id: pack_id || null,
      fecha_hora: f,
      tipo,
      duracion_minutos: duracion,
      estado: 'programada',
      enlace_videollamada: tipo === 'videollamada' ? (enlace_videollamada || null) : null,
      ...(sinPack ? { estado_pago: 'no_pagado', precio_cents: precioSuelta } : {}),
    }));

    const { data, error } = await supabase.from('sesiones').insert(filas).select();
    if (error) {
      // 23505 = el índice único uniq_sesiones_fecha_activa: ya hay una sesión
      // activa en esa hora exacta (lo bloquea la BD aunque pasara checkSolape).
      if (error.code === '23505') return res.status(409).json({ error: 'solape' });
      return res.status(400).json({ error: error.message });
    }

    // Una entrada de auditoría por cada sesión creada (RGPD Art. 30): una serie
    // debe dejar rastro de TODAS sus sesiones, no solo de la primera.
    (data || []).forEach((s) => {
      audit(req, 'create_session', 'sessions', s.id, {
        paciente_id,
        fecha_hora: s.fecha_hora,
        ...(repeticiones > 1 ? { serie: true, repeticiones } : {}),
      });
    });

    // Si Andrea tiene Google conectado y no pegó enlace manual, cada sesión de
    // videollamada recibe su propio Meet antes de responder y de enviar el email.
    await generarEnlacesMeet(data || []);

    // Confirmación inmediata al paciente, con el .ics (fire-and-forget)
    supabase
      .from('pacientes')
      .select('users ( email, nombre_completo, idioma_preferido )')
      .eq('id', paciente_id)
      .single()
      .then(({ data: p }) => {
        const u = p?.users;
        if (u?.email) {
          sendSessionConfirmation(u.email, u.nombre_completo, data, u.idioma_preferido)
            .catch((e) => console.error('[create] email confirmación:', e.message));
        }
      }, () => {});

    res.status(201).json(repeticiones === 1 ? data[0] : data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cualquier rol: huecos libres de un día (para que el paciente pida cita).
// Considera horario laboral, sesiones existentes y calendarios externos.
router.get('/disponibilidad', verifyToken, async (req, res) => {
  const { fecha } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
    return res.status(400).json({ error: 'fecha es obligatoria (YYYY-MM-DD)' });
  }

  try {
    const inicioDia = `${fecha}T00:00:00`;
    const finDia = `${fecha}T23:59:59`;

    if (!DIAS_LABORALES.includes(diaSemana(inicioDia))) return res.json({ slots: [] });

    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select('fecha_hora, duracion_minutos')
      .in('estado', ['programada', 'solicitada'])
      .gte('fecha_hora', msToNaive(naiveToMs(inicioDia) - 4 * 3600000))
      .lte('fecha_hora', finDia);
    if (error) return res.status(400).json({ error: error.message });

    let externos = [];
    try {
      externos = await bloquesOcupados(inicioDia, finDia);
    } catch (err) {
      console.error('[disponibilidad] calendarios externos:', err.message);
    }

    const ocupados = [
      ...(sesiones || []).map((s) => {
        const ini = naiveToMs(s.fecha_hora);
        return [ini, ini + (s.duracion_minutos || 50) * 60000];
      }),
      ...externos.map((b) => [naiveToMs(b.inicio), naiveToMs(b.fin)]),
    ];

    const minimoMs = ahoraParedMs() + ANTELACION_MINIMA_HORAS * 3600000;
    const slots = [];
    for (let h = HORA_INICIO; h < HORA_FIN; h++) {
      const ini = naiveToMs(`${fecha}T${String(h).padStart(2, '0')}:00:00`);
      const fin = ini + 50 * 60000;
      if (ini < minimoMs) continue;
      if (ocupados.some(([oIni, oFin]) => oIni < fin && oFin > ini)) continue;
      slots.push(`${String(h).padStart(2, '0')}:00`);
    }

    res.json({ slots });
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paciente: solicitar una cita en un hueco libre. Queda 'solicitada' hasta que
// Andrea la confirme o rechace desde el calendario.
router.post('/solicitar', verifyToken, async (req, res) => {
  if (req.user.role !== 'paciente') {
    return res.status(403).json({ error: 'Solo para pacientes' });
  }
  const { fecha_hora, tipo } = req.body;
  if (!FECHA_NAIVE_RE.test(String(fecha_hora))) {
    return res.status(400).json({ error: 'fecha_hora debe tener formato YYYY-MM-DDTHH:MM' });
  }
  if (!['videollamada', 'presencial'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo no válido' });
  }

  try {
    const ms = naiveToMs(fecha_hora);
    const hora = new Date(ms).getUTCHours();
    const minutos = new Date(ms).getUTCMinutes();
    if (!DIAS_LABORALES.includes(diaSemana(fecha_hora)) || hora < HORA_INICIO || hora >= HORA_FIN || minutos !== 0) {
      return res.status(400).json({ error: 'fuera_de_horario' });
    }
    if (ms < ahoraParedMs() + ANTELACION_MINIMA_HORAS * 3600000) {
      return res.status(400).json({ error: 'antelacion_minima' });
    }

    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id, estado, users ( nombre_completo, idioma_preferido ), packs ( id, estado )')
      .eq('user_id', req.user.id)
      .single();
    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });
    if (paciente.estado === 'archivado') return res.status(403).json({ error: 'Cuenta inactiva' });

    // No filtrar a otros pacientes: la respuesta de solape es genérica
    const solape = await checkSolape(fecha_hora, 50);
    if (solape) return res.status(409).json({ error: 'ocupado' });

    const packActivo = (paciente.packs || []).find((p) => p.estado === 'activo');

    // Sin pack activo, la sesión es suelta: nace 'no_pagado' con precio de tarifa.
    const insertSesion = {
      paciente_id: paciente.id,
      pack_id: packActivo?.id || null,
      fecha_hora,
      tipo,
      duracion_minutos: 50,
      estado: 'solicitada',
    };
    if (!packActivo) {
      insertSesion.estado_pago = 'no_pagado';
      insertSesion.precio_cents = await tarifaPrecio('sesion_individual');
    }

    const { data, error } = await supabase
      .from('sesiones')
      .insert(insertSesion)
      .select()
      .single();
    if (error) {
      // 23505 = índice único uniq_sesiones_fecha_activa: alguien cogió ese
      // hueco entre el checkSolape y el insert (race). La BD lo impide.
      if (error.code === '23505') return res.status(409).json({ error: 'ocupado' });
      return res.status(400).json({ error: error.message });
    }

    audit(req, 'request_session', 'sessions', data.id, { fecha_hora, tipo });

    // El nombre no viaja en el JWT (solo id/email/role): se toma del perfil.
    const nombrePaciente = paciente.users?.nombre_completo || '';

    // Acuse de recibo al paciente (fire-and-forget)
    if (req.user.email) {
      sendSessionRequestAck(req.user.email, nombrePaciente, data, paciente.users?.idioma_preferido)
        .catch((e) => console.error('[solicitar] email acuse:', e.message));
    }

    // Avisar a Andrea (fire-and-forget)
    try {
      const { data: admin } = await supabase
        .from('users').select('email').eq('role', 'admin').limit(1).single();
      if (admin?.email) {
        sendSessionRequestToAdmin(admin.email, nombrePaciente || req.user.email, data)
          .catch((e) => console.error('[solicitar] email admin:', e.message));
      }
    } catch (e) {
      console.error('[solicitar] lookup admin:', e.message);
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: añadir o actualizar el enlace de videollamada de una sesión ya creada
// (p. ej. cuando el Meet se genera después de agendar la cita).
router.put('/:id/enlace', verifyToken, requireAdmin, async (req, res) => {
  const { enlace_videollamada } = req.body;
  if (enlace_videollamada && !enlaceValido(enlace_videollamada)) {
    return res.status(400).json({ error: 'El enlace debe ser una URL https válida' });
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('tipo')
      .eq('id', req.params.id)
      .single();
    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (current.tipo !== 'videollamada') {
      return res.status(400).json({ error: 'Solo las sesiones de videollamada llevan enlace' });
    }

    const { data, error } = await supabase
      .from('sesiones')
      .update({ enlace_videollamada: enlace_videollamada || null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'update_session_link', 'sessions', req.params.id, {});
    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: generar un enlace de Google Meet para una sesión ya creada (botón
// "Generar enlace de Meet"). Requiere la cuenta de Google conectada.
router.post('/:id/generar-meet', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data: sesion, error: fetchError } = await supabase
      .from('sesiones')
      .select('id, tipo, estado, fecha_hora, duracion_minutos, enlace_videollamada')
      .eq('id', req.params.id)
      .single();
    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (sesion.tipo !== 'videollamada') {
      return res.status(400).json({ error: 'Solo las sesiones de videollamada llevan enlace' });
    }
    if (!['programada', 'solicitada'].includes(sesion.estado)) {
      return res.status(400).json({ error: 'La sesión ya no está activa' });
    }

    const resultado = await meet.crearEventoMeet(sesion.fecha_hora, sesion.duracion_minutos);
    if (!resultado) {
      return res.status(409).json({ error: 'Google no está conectado o la conexión ha caducado. En el calendario, abre "Sincronizar" y pulsa "Conectar con Google".' });
    }

    const { data, error } = await supabase
      .from('sesiones')
      .update({ enlace_videollamada: resultado.enlace, google_event_id: resultado.eventId, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'generate_meet_link', 'sessions', req.params.id, {});
    res.json(data);
  } catch (err) {
    console.error('[generar-meet]', err.message);
    res.status(502).json({ error: 'No se pudo generar el enlace de Meet' });
  }
});

// Admin: todas las sesiones (para el calendario)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.query;

  try {
    let query = supabase
      .from('sesiones')
      .select(`
        id, paciente_id, pack_id, fecha_hora, tipo, estado, duracion_minutos, enlace_videollamada,
        pacientes ( users ( nombre_completo, email ) )
      `)
      .order('fecha_hora', { ascending: true });

    if (desde) query = query.gte('fecha_hora', desde);
    if (hasta) query = query.lte('fecha_hora', hasta);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'view_calendar', 'sessions', null, { desde: desde || null, hasta: hasta || null });
    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: marcar sesión (completada / cancelada_con_cargo / cancelada)
router.put('/:id/estado', verifyToken, requireAdmin, async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['programada', 'completada', 'cancelada', 'cancelada_con_cargo'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('estado, pack_id, tipo, google_event_id, pacientes ( users ( email, nombre_completo, idioma_preferido ) )')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });

    const { data, error } = await supabase
      .from('sesiones')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'update_session_status', 'sessions', req.params.id, {
      estado_anterior: current.estado,
      estado_nuevo: estado,
    });

    // Al aceptar una solicitud de videollamada, generar su Meet antes del email
    // de confirmación para que el paciente ya reciba el enlace (best-effort).
    if (current.estado === 'solicitada' && estado === 'programada') {
      await generarEnlacesMeet([data]);
    }

    // Al cancelar, quitar el evento del Google Calendar de Andrea (best-effort)
    if ((estado === 'cancelada' || estado === 'cancelada_con_cargo') && current.google_event_id) {
      meet.borrarEventoMeet(current.google_event_id)
        .catch((e) => console.error('[estado] borrar evento Meet:', e.message));
    }

    // Si era una solicitud del paciente, avisarle del resultado (fire-and-forget)
    if (current.estado === 'solicitada' && (estado === 'programada' || estado === 'cancelada')) {
      const user = current.pacientes?.users;
      if (user?.email) {
        sendSessionRequestResult(user.email, user.nombre_completo, data, estado === 'programada', user.idioma_preferido)
          .catch((e) => console.error('[estado] email resultado solicitud:', e.message));
      }
    }

    // Descontar del pack solo si la sesión estaba programada (evita doble descuento)
    const debeDescontar = (estado === 'completada' || estado === 'cancelada_con_cargo')
      && current.estado === 'programada'
      && data.pack_id;

    if (debeDescontar) {
      const { error: rpcError } = await supabase.rpc('incrementar_sesion_pack', { pack_uuid: data.pack_id });
      if (rpcError) console.error('incrementar_sesion_pack failed:', rpcError.message);

      // Alerta si al paciente le quedan ≤2 sesiones en el pack
      try {
        const { data: pack } = await supabase
          .from('packs')
          .select('num_sesiones_total, num_sesiones_usadas, pacientes ( users ( email, nombre_completo, idioma_preferido ) )')
          .eq('id', data.pack_id)
          .single();

        if (pack) {
          const restantes = pack.num_sesiones_total - pack.num_sesiones_usadas;
          if (restantes > 0 && restantes <= 2) {
            const user = pack.pacientes?.users;
            if (user?.email) {
              await sendPackLowAlert(user.email, user.nombre_completo, restantes, user.idioma_preferido);
            }
          }
        }
      } catch (alertErr) {
        // No interrumpir la respuesta si el email falla
        console.error('[sesiones] Error enviando alerta pack bajo:', alertErr.message);
      }
    }

    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: marcar el pago de una sesión SUELTA (pack_id NULL). Las sesiones de un
// pack se cobran a nivel de pack (packs.estado_pago), no aquí.
router.put('/:id/pago', verifyToken, requireAdmin, async (req, res) => {
  const { estado_pago } = req.body;
  if (!['no_pagado', 'pagado'].includes(estado_pago)) {
    return res.status(400).json({ error: 'estado_pago inválido' });
  }
  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('pack_id')
      .eq('id', req.params.id)
      .single();
    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (current.pack_id) {
      return res.status(400).json({ error: 'Esta sesión va con un pack; el pago se gestiona en el pack' });
    }

    const { data, error } = await supabase
      .from('sesiones')
      .update({
        estado_pago,
        fecha_pago: estado_pago === 'pagado' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'update_session_payment', 'sessions', req.params.id, { estado_pago });
    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: reagendar sesión (nueva fecha, misma sesión)
router.put('/:id/reagendar', verifyToken, requireAdmin, async (req, res) => {
  const { fecha_hora, force } = req.body;
  if (!fecha_hora) return res.status(400).json({ error: 'fecha_hora es obligatorio' });
  if (!FECHA_NAIVE_RE.test(String(fecha_hora))) {
    return res.status(400).json({ error: 'fecha_hora debe tener formato YYYY-MM-DDTHH:MM' });
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('estado, fecha_hora, duracion_minutos, pacientes ( users ( email, nombre_completo, idioma_preferido ) )')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (current.estado !== 'programada') {
      return res.status(400).json({ error: 'Solo se pueden reagendar sesiones programadas' });
    }

    if (!force) {
      const solape = await checkSolape(fecha_hora, current.duracion_minutos || 50, req.params.id);
      if (solape) return res.status(409).json({ error: 'solape', solapa_con: solape });
    }

    // Se resetea el flag para que la nueva fecha reciba su propio recordatorio
    const { data, error } = await supabase
      .from('sesiones')
      .update({ fecha_hora, recordatorio_enviado: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      // 23505 = índice único uniq_sesiones_fecha_activa: ya hay una sesión
      // activa en la nueva hora exacta.
      if (error.code === '23505') return res.status(409).json({ error: 'solape' });
      return res.status(400).json({ error: error.message });
    }

    audit(req, 'reschedule_session', 'sessions', req.params.id, {
      fecha_anterior: current.fecha_hora,
      fecha_nueva: fecha_hora,
    });

    // Mover el evento de Meet a la nueva hora (el enlace no cambia; best-effort)
    if (data.google_event_id) {
      meet.moverEventoMeet(data.google_event_id, fecha_hora, data.duracion_minutos)
        .catch((e) => console.error('[reagendar] mover evento Meet:', e.message));
    }

    // Avisar al paciente del cambio de fecha, con el .ics actualizado (fire-and-forget)
    const user = current.pacientes?.users;
    if (user?.email) {
      sendSessionRescheduled(user.email, user.nombre_completo, data, current.fecha_hora, user.idioma_preferido)
        .catch((e) => console.error('[reagendar] email aviso:', e.message));
    }

    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paciente: sus propias sesiones
router.get('/mis-sesiones', verifyToken, async (req, res) => {
  try {
    // Obtener paciente_id del user
    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data, error } = await supabase
      .from('sesiones')
      .select('id, fecha_hora, tipo, estado, duracion_minutos, enlace_videollamada, pack_id, estado_pago, precio_cents')
      .eq('paciente_id', paciente.id)
      .order('fecha_hora', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin o el propio paciente: descargar la cita en formato iCalendar (.ics)
router.get('/:id/ics', verifyToken, async (req, res) => {
  try {
    const { data: sesion, error } = await supabase
      .from('sesiones')
      .select('id, fecha_hora, duracion_minutos, tipo, enlace_videollamada, pacientes ( user_id )')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Sesión no encontrada' });

    const esDueno = sesion.pacientes?.user_id === req.user.id;
    if (req.user.role !== 'admin' && !esDueno) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="cita-studio-renacer.ics"');
    res.send(buildSessionICS(sesion));
  } catch (err) {
    console.error('[sesiones]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
