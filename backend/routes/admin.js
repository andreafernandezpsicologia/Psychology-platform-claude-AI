const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { aParedMadrid } = require('../services/fechaPared');

const router = express.Router();

// yyyy-mm en Europe/Madrid (para agrupar pagos "de este mes" desde un timestamptz).
const fmtMes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' });
const mesMadrid = (d) => fmtMes.format(new Date(d)); // 'YYYY-MM'

// Mes anterior a 'YYYY-MM' (n saltos atrás)
function mesMenos(mes, n = 1) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 7);
}

// ── Admin: resumen para la pantalla de Inicio ────────────────────────────────
// ?mes=YYYY-MM (opcional, por defecto el mes actual de Madrid). KPIs del mes con
// comparativa vs el anterior, detalle clicable de cada KPI, serie de ingresos de
// 6 meses, hoy + próximos 7 días y "requiere atención". Un solo terapeuta: el
// volumen es pequeño, así que se traen las filas y se agrega en JS.
router.get('/resumen', verifyToken, requireAdmin, async (req, res) => {
  try {
    const ahora = new Date();
    const hoyStr = aParedMadrid(ahora).slice(0, 10);   // 'YYYY-MM-DD' (Madrid)
    const nowNaive = aParedMadrid(ahora);               // 'YYYY-MM-DDTHH:mm:ss'
    const mesActual = nowNaive.slice(0, 7);
    const mesSel = /^\d{4}-\d{2}$/.test(req.query.mes || '') ? req.query.mes : mesActual;
    const mesPrev = mesMenos(mesSel, 1);
    const hace7 = new Date(ahora.getTime() - 7 * 86400000).toISOString();
    const en7Str = aParedMadrid(new Date(ahora.getTime() + 7 * 86400000)).slice(0, 10);

    const selPacRel = 'pacientes ( user_id, users ( nombre_completo ) )';
    const [sesRes, packRes, pacRes, cuotasRes, fsRes, ffRes] = await Promise.all([
      supabase.from('sesiones').select(`id, fecha_hora, tipo, estado, estado_pago, precio_cents, fecha_pago, pack_id, enlace_videollamada, paciente_id, ${selPacRel}`),
      supabase.from('packs').select('id, paciente_id, estado, estado_pago, precio_cents, fecha_pago, num_sesiones_total, num_cuotas'),
      supabase.from('pacientes').select('id, estado, user_id, users ( nombre_completo )'),
      supabase.from('cuotas_pack').select('id, pack_id, numero, importe_cents, estado_pago, fecha_pago, fecha_limite'),
      supabase.from('feedback_sesiones').select(`id, tipo, respondido_en, paciente_id, ${selPacRel}`)
        .not('respondido_en', 'is', null).gte('respondido_en', hace7).order('respondido_en', { ascending: false }),
      supabase.from('feedback_final').select(`id, respondido_en, satisfaccion, paciente_id, ${selPacRel}`)
        .not('respondido_en', 'is', null).gte('respondido_en', hace7).order('respondido_en', { ascending: false }),
    ]);
    for (const r of [sesRes, packRes, pacRes, cuotasRes, fsRes, ffRes]) {
      if (r.error) return res.status(400).json({ error: r.error.message });
    }

    const sesiones = sesRes.data || [];
    const packs = packRes.data || [];
    const pacientes = pacRes.data || [];
    const cuotas = cuotasRes.data || [];

    // Mapa paciente_id → { nombre, user_id } (para packs/cuotas, que no traen la relación)
    const pacMap = {};
    for (const p of pacientes) pacMap[p.id] = { nombre: p.users?.nombre_completo || '—', user_id: p.user_id };
    const nombreRel = (row) => row?.pacientes?.users?.nombre_completo || '—';
    const userIdRel = (row) => row?.pacientes?.user_id || null;
    const pacDe = (row) => ({ nombre: nombreRel(row), user_id: userIdRel(row) });
    const cuotasPorPack = {};
    for (const c of cuotas) (cuotasPorPack[c.pack_id] = cuotasPorPack[c.pack_id] || []).push(c);

    // ── KPIs por mes (funciones para poder calcular sel + prev + serie) ──────
    const sesionesHechas = (m) => sesiones.filter((s) => s.estado === 'completada' && String(s.fecha_hora).slice(0, 7) === m).length;
    const noShows = (m) => sesiones.filter((s) => s.estado === 'no_show' && String(s.fecha_hora).slice(0, 7) === m).length;
    // Ingresos: sesiones sueltas pagadas + bonos, ambos por su fecha_pago.
    // Bonos CON cuotas: cuenta cada cuota pagada en su mes (el pack no, para no
    // duplicar). Bonos sin cuotas: cuenta el pack al marcarse pagado.
    const ingresos = (m) => {
      let total = 0;
      for (const s of sesiones) if (s.estado_pago === 'pagado' && s.fecha_pago && mesMadrid(s.fecha_pago) === m) total += s.precio_cents || 0;
      for (const pk of packs) {
        const cs = cuotasPorPack[pk.id] || [];
        if (cs.length > 0) {
          for (const c of cs) if (c.estado_pago === 'pagado' && c.fecha_pago && mesMadrid(c.fecha_pago) === m) total += c.importe_cents || 0;
        } else if (pk.estado_pago === 'pagado' && pk.fecha_pago && mesMadrid(pk.fecha_pago) === m) {
          total += pk.precio_cents || 0;
        }
      }
      return total;
    };

    const pacientesActivos = pacientes.filter((p) => p.estado === 'activo');

    // Pendiente de cobro (estado actual, no depende del mes):
    //  - sesiones sueltas ya cobrables (hechas/cargadas) sin pagar
    //  - bonos sin pagar (si tienen cuotas, solo las cuotas impagadas)
    // importe_cents null = "no se sabe cuánto" (sin precio, o parcial manual sin
    // cuotas): la fila se lista igualmente (visible) pero suma 0 al KPI.
    const pendienteDetalle = [];
    for (const s of sesiones) {
      if (!s.pack_id && s.estado_pago === 'no_pagado'
        && ['completada', 'cancelada_con_cargo', 'no_show'].includes(s.estado)) {
        pendienteDetalle.push({ tipo: 'sesion', fecha: s.fecha_hora, importe_cents: s.precio_cents ?? null, paciente: pacDe(s) });
      }
    }
    for (const pk of packs) {
      if (pk.estado_pago === 'pagado' || pk.estado === 'cancelado') continue;
      const cs = cuotasPorPack[pk.id] || [];
      const pacPk = pacMap[pk.paciente_id] || { nombre: '—', user_id: null };
      if (cs.length > 0) {
        for (const c of cs) {
          if (c.estado_pago !== 'pagado') {
            pendienteDetalle.push({ tipo: 'cuota', numero: c.numero, total_cuotas: cs.length, fecha: c.fecha_limite, importe_cents: c.importe_cents ?? null, paciente: pacPk });
          }
        }
      } else if (pk.estado_pago === 'no_pagado') {
        pendienteDetalle.push({ tipo: 'bono', sesiones: pk.num_sesiones_total, fecha: null, importe_cents: pk.precio_cents ?? null, paciente: pacPk });
      } else if (pk.estado_pago === 'pago_parcial') {
        // Parcial marcado a mano (sin cuotas): no se sabe el resto → importe null
        pendienteDetalle.push({ tipo: 'bono', parcial: true, sesiones: pk.num_sesiones_total, fecha: null, importe_cents: null, paciente: pacPk });
      }
    }
    pendienteDetalle.sort((a, b) => String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')));
    const pendienteCents = pendienteDetalle.reduce((acc, r) => acc + (r.importe_cents || 0), 0);

    // ── Detalles del mes seleccionado ────────────────────────────────────────
    const detIngresos = [];
    for (const s of sesiones) {
      if (s.estado_pago === 'pagado' && s.fecha_pago && mesMadrid(s.fecha_pago) === mesSel) {
        detIngresos.push({ tipo: 'sesion', fecha: s.fecha_pago, fecha_sesion: s.fecha_hora, importe_cents: s.precio_cents || 0, paciente: pacDe(s) });
      }
    }
    for (const pk of packs) {
      const cs = cuotasPorPack[pk.id] || [];
      const pacPk = pacMap[pk.paciente_id] || { nombre: '—', user_id: null };
      if (cs.length > 0) {
        for (const c of cs) {
          if (c.estado_pago === 'pagado' && c.fecha_pago && mesMadrid(c.fecha_pago) === mesSel) {
            detIngresos.push({ tipo: 'cuota', numero: c.numero, total_cuotas: cs.length, sesiones: pk.num_sesiones_total, fecha: c.fecha_pago, importe_cents: c.importe_cents || 0, paciente: pacPk });
          }
        }
      } else if (pk.estado_pago === 'pagado' && pk.fecha_pago && mesMadrid(pk.fecha_pago) === mesSel) {
        detIngresos.push({ tipo: 'bono', sesiones: pk.num_sesiones_total, fecha: pk.fecha_pago, importe_cents: pk.precio_cents || 0, paciente: pacPk });
      }
    }
    detIngresos.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    const detSesiones = sesiones
      .filter((s) => s.estado === 'completada' && String(s.fecha_hora).slice(0, 7) === mesSel)
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)))
      .map((s) => ({ fecha_hora: s.fecha_hora, tipo: s.tipo, con_bono: !!s.pack_id, paciente: pacDe(s) }));

    const detNoShows = sesiones
      .filter((s) => s.estado === 'no_show' && String(s.fecha_hora).slice(0, 7) === mesSel)
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)))
      .map((s) => ({ fecha_hora: s.fecha_hora, tipo: s.tipo, paciente: pacDe(s) }));

    // Pacientes activos con su próxima cita y su última sesión hecha
    const detPacientes = pacientesActivos.map((p) => {
      const suyas = sesiones.filter((s) => s.paciente_id === p.id);
      const proxima = suyas.filter((s) => s.estado === 'programada' && String(s.fecha_hora) >= nowNaive)
        .sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))[0];
      const ultima = suyas.filter((s) => s.estado === 'completada')
        .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)))[0];
      return { nombre: p.users?.nombre_completo || '—', user_id: p.user_id, proxima: proxima?.fecha_hora || null, ultima: ultima?.fecha_hora || null };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));

    // Serie de ingresos de los últimos 6 meses (terminando en el mes elegido)
    const ingresos6m = [];
    for (let i = 5; i >= 0; i--) {
      const m = mesMenos(mesSel, i);
      ingresos6m.push({ mes: m, total_cents: ingresos(m) });
    }

    // ── Hoy y próximos 7 días ────────────────────────────────────────────────
    const mapSesion = (s) => ({
      id: s.id, fecha_hora: s.fecha_hora, tipo: s.tipo, estado: s.estado,
      enlace: s.enlace_videollamada, paciente: pacDe(s),
    });
    const hoy = sesiones
      .filter((s) => String(s.fecha_hora).slice(0, 10) === hoyStr)
      .sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))
      .map(mapSesion);
    const semana = sesiones
      .filter((s) => ['programada', 'solicitada'].includes(s.estado)
        && String(s.fecha_hora).slice(0, 10) > hoyStr
        && String(s.fecha_hora).slice(0, 10) <= en7Str)
      .sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))
      .map(mapSesion);

    // ── Requiere atención ────────────────────────────────────────────────────
    const sinPagar = sesiones
      .filter((s) => !s.pack_id && s.estado_pago === 'no_pagado'
        && ['completada', 'cancelada_con_cargo', 'no_show'].includes(s.estado))
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)))
      .map((s) => ({ id: s.id, fecha_hora: s.fecha_hora, precio_cents: s.precio_cents, paciente: pacDe(s) }));

    const conPackActivo = new Set(packs.filter((pk) => pk.estado === 'activo').map((pk) => pk.paciente_id));
    const sueltasPorPac = {};
    for (const s of sesiones) {
      if (!s.pack_id && s.estado === 'completada') sueltasPorPac[s.paciente_id] = (sueltasPorPac[s.paciente_id] || 0) + 1;
    }
    const candidatos = pacientesActivos
      .filter((p) => !conPackActivo.has(p.id) && (sueltasPorPac[p.id] || 0) >= 3)
      .map((p) => ({ user_id: p.user_id, nombre: p.users?.nombre_completo || '—', sueltas: sueltasPorPac[p.id] }))
      .sort((a, b) => b.sueltas - a.sueltas);

    const feedbackReciente = [
      ...(fsRes.data || []).map((f) => ({ tipo: f.tipo, fecha: f.respondido_en, paciente: pacDe(f) })),
      ...(ffRes.data || []).map((f) => ({ tipo: 'cierre', fecha: f.respondido_en, satisfaccion: f.satisfaccion, paciente: pacDe(f) })),
    ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    res.json({
      mes: mesSel,
      mes_actual: mesActual,
      kpis: {
        ingresos_cents: ingresos(mesSel),
        sesiones_hechas: sesionesHechas(mesSel),
        no_shows: noShows(mesSel),
        pacientes_activos: pacientesActivos.length,
        pendiente_cents: pendienteCents,
      },
      kpis_prev: {
        mes: mesPrev,
        ingresos_cents: ingresos(mesPrev),
        sesiones_hechas: sesionesHechas(mesPrev),
        no_shows: noShows(mesPrev),
      },
      ingresos_6m: ingresos6m,
      detalle: {
        ingresos: detIngresos,
        sesiones: detSesiones,
        no_shows: detNoShows,
        pacientes: detPacientes,
        pendiente: pendienteDetalle,
      },
      hoy,
      semana,
      atencion: {
        sesiones_sin_pagar: sinPagar,
        feedback_reciente: feedbackReciente,
        candidatos_bono: candidatos,
      },
    });
  } catch (err) {
    console.error('[admin/resumen]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
