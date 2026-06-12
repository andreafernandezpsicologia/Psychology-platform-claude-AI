const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendPackLowAlert } = require('../services/emailService');
const { audit } = require('../services/auditLog');
const { buildSessionICS } = require('../services/icsService');

const router = express.Router();

// fecha_hora se guarda como hora de pared (Europe/Madrid) SIN zona horaria.
// Toda la aritmética se hace en UTC "ficticio" (Date.UTC sobre los componentes)
// para no depender de la TZ del servidor. Nunca usar new Date(string) aquí.
const FECHA_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

function naiveToMs(naive) {
  const m = String(naive).match(FECHA_NAIVE_RE);
  if (!m) throw new Error(`fecha_hora inválida: ${naive}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

function msToNaive(ms) {
  return new Date(ms).toISOString().slice(0, 19);
}

// Devuelve la sesión programada que se solapa con [fecha_hora, fecha_hora + duración), o null.
// La ventana de búsqueda arranca 4h antes para capturar sesiones largas aún en curso.
async function checkSolape(fechaHora, duracionMinutos, excludeId = null) {
  const inicio = naiveToMs(fechaHora);
  const fin = inicio + duracionMinutos * 60000;

  let query = supabase
    .from('sesiones')
    .select('id, fecha_hora, duracion_minutos, pacientes ( users ( nombre_completo ) )')
    .eq('estado', 'programada')
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

  if (!conflicto) return null;
  return {
    id: conflicto.id,
    fecha_hora: conflicto.fecha_hora,
    duracion_minutos: conflicto.duracion_minutos,
    paciente_nombre: conflicto.pacientes?.users?.nombre_completo || '—',
  };
}

// Admin: crear sesión para un paciente
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { paciente_id, pack_id, fecha_hora, tipo, duracion_minutos, force } = req.body;
  if (!paciente_id || !fecha_hora || !tipo) {
    return res.status(400).json({ error: 'paciente_id, fecha_hora y tipo son obligatorios' });
  }
  if (!FECHA_NAIVE_RE.test(String(fecha_hora))) {
    return res.status(400).json({ error: 'fecha_hora debe tener formato YYYY-MM-DDTHH:MM' });
  }

  try {
    const duracion = duracion_minutos || 50;

    if (!force) {
      const solape = await checkSolape(fecha_hora, duracion);
      if (solape) return res.status(409).json({ error: 'solape', solapa_con: solape });
    }

    const { data, error } = await supabase
      .from('sesiones')
      .insert({
        paciente_id,
        pack_id: pack_id || null,
        fecha_hora,
        tipo,
        duracion_minutos: duracion,
        estado: 'programada',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'create_session', 'sessions', data.id, { paciente_id, fecha_hora });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: todas las sesiones (para el calendario)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.query;

  try {
    let query = supabase
      .from('sesiones')
      .select(`
        id, paciente_id, pack_id, fecha_hora, tipo, estado, duracion_minutos,
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
    res.status(500).json({ error: err.message });
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
      .select('estado, pack_id')
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
          .select('num_sesiones_total, num_sesiones_usadas, pacientes ( users ( email, nombre_completo ) )')
          .eq('id', data.pack_id)
          .single();

        if (pack) {
          const restantes = pack.num_sesiones_total - pack.num_sesiones_usadas;
          if (restantes > 0 && restantes <= 2) {
            const user = pack.pacientes?.users;
            if (user?.email) {
              await sendPackLowAlert(user.email, user.nombre_completo, restantes);
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
    res.status(500).json({ error: err.message });
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
      .select('estado, fecha_hora, duracion_minutos')
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

    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'reschedule_session', 'sessions', req.params.id, {
      fecha_anterior: current.fecha_hora,
      fecha_nueva: fecha_hora,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      .select('id, fecha_hora, tipo, estado, duracion_minutos')
      .eq('paciente_id', paciente.id)
      .order('fecha_hora', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin o el propio paciente: descargar la cita en formato iCalendar (.ics)
router.get('/:id/ics', verifyToken, async (req, res) => {
  try {
    const { data: sesion, error } = await supabase
      .from('sesiones')
      .select('id, fecha_hora, duracion_minutos, tipo, pacientes ( user_id )')
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
