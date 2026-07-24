const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { aParedMadrid } = require('../services/fechaPared');

const router = express.Router();

// yyyy-mm en Europe/Madrid (para agrupar pagos "de este mes" desde un timestamptz).
const fmtMes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit' });
const mesMadrid = (d) => fmtMes.format(new Date(d)); // 'YYYY-MM'

// ── Admin: resumen para la pantalla de Inicio (KPIs + hoy + requiere atención) ──
// Una sola llamada agrega todo. El volumen de una consulta individual es pequeño
// (un solo terapeuta), así que se traen las filas y se agregan en JS.
router.get('/resumen', verifyToken, requireAdmin, async (req, res) => {
  try {
    const ahora = new Date();
    const hoyStr = aParedMadrid(ahora).slice(0, 10);   // 'YYYY-MM-DD' (Madrid)
    const mesActual = aParedMadrid(ahora).slice(0, 7);  // 'YYYY-MM'   (Madrid)
    const hace7 = new Date(ahora.getTime() - 7 * 86400000).toISOString();

    const selPacRel = 'pacientes ( user_id, users ( nombre_completo ) )';
    const [sesRes, packRes, pacRes, fsRes, ffRes] = await Promise.all([
      supabase.from('sesiones').select(`id, fecha_hora, tipo, estado, estado_pago, precio_cents, fecha_pago, pack_id, enlace_videollamada, paciente_id, ${selPacRel}`),
      supabase.from('packs').select('id, paciente_id, estado, estado_pago, precio_cents, fecha_pago'),
      supabase.from('pacientes').select('id, estado, user_id, users ( nombre_completo )'),
      supabase.from('feedback_sesiones').select(`id, tipo, respondido_en, paciente_id, ${selPacRel}`)
        .not('respondido_en', 'is', null).gte('respondido_en', hace7).order('respondido_en', { ascending: false }),
      supabase.from('feedback_final').select(`id, respondido_en, satisfaccion, paciente_id, ${selPacRel}`)
        .not('respondido_en', 'is', null).gte('respondido_en', hace7).order('respondido_en', { ascending: false }),
    ]);
    for (const r of [sesRes, packRes, pacRes, fsRes, ffRes]) {
      if (r.error) return res.status(400).json({ error: r.error.message });
    }

    const sesiones = sesRes.data || [];
    const packs = packRes.data || [];
    const pacientes = pacRes.data || [];
    const nombreRel = (row) => row?.pacientes?.users?.nombre_completo || '—';
    const userIdRel = (row) => row?.pacientes?.user_id || null;
    const enMes = (fechaHora) => String(fechaHora).slice(0, 7) === mesActual; // naive Madrid

    // ── KPIs del mes ──
    const sesionesHechasMes = sesiones.filter((s) => s.estado === 'completada' && enMes(s.fecha_hora)).length;
    const noShowsMes = sesiones.filter((s) => s.estado === 'no_show' && enMes(s.fecha_hora)).length;
    const pacientesActivos = pacientes.filter((p) => p.estado === 'activo').length;

    // Ingresos: sesiones sueltas + bonos marcados pagados con fecha_pago en el mes.
    // Cobra tanto pago manual como online (ambos marcan estado_pago='pagado'), sin
    // doble conteo. Los bonos a medias (cuota 1/2) no cuentan hasta completarse.
    let ingresosCentsMes = 0;
    for (const s of sesiones) {
      if (s.estado_pago === 'pagado' && s.fecha_pago && mesMadrid(s.fecha_pago) === mesActual) ingresosCentsMes += s.precio_cents || 0;
    }
    for (const pk of packs) {
      if (pk.estado_pago === 'pagado' && pk.fecha_pago && mesMadrid(pk.fecha_pago) === mesActual) ingresosCentsMes += pk.precio_cents || 0;
    }

    // ── Hoy ──
    const hoy = sesiones
      .filter((s) => String(s.fecha_hora).slice(0, 10) === hoyStr)
      .sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)))
      .map((s) => ({
        id: s.id, fecha_hora: s.fecha_hora, tipo: s.tipo, estado: s.estado,
        enlace: s.enlace_videollamada,
        paciente: { nombre: nombreRel(s), user_id: userIdRel(s) },
      }));

    // ── Requiere atención ──
    // Sesiones sin pagar: suelta (sin pack), ya realizada/cobrable, aún no pagada.
    const sinPagar = sesiones
      .filter((s) => !s.pack_id && s.estado_pago === 'no_pagado'
        && ['completada', 'cancelada_con_cargo', 'no_show'].includes(s.estado))
      .sort((a, b) => String(b.fecha_hora).localeCompare(String(a.fecha_hora)))
      .map((s) => ({
        id: s.id, fecha_hora: s.fecha_hora, precio_cents: s.precio_cents,
        paciente: { nombre: nombreRel(s), user_id: userIdRel(s) },
      }));

    // Candidatos a bono: activos, sin pack activo, con ≥3 sesiones sueltas completadas.
    const conPackActivo = new Set(packs.filter((pk) => pk.estado === 'activo').map((pk) => pk.paciente_id));
    const sueltasPorPac = {};
    for (const s of sesiones) {
      if (!s.pack_id && s.estado === 'completada') sueltasPorPac[s.paciente_id] = (sueltasPorPac[s.paciente_id] || 0) + 1;
    }
    const candidatos = pacientes
      .filter((p) => p.estado === 'activo' && !conPackActivo.has(p.id) && (sueltasPorPac[p.id] || 0) >= 3)
      .map((p) => ({ user_id: p.user_id, nombre: p.users?.nombre_completo || '—', sueltas: sueltasPorPac[p.id] }))
      .sort((a, b) => b.sueltas - a.sueltas);

    // Feedback reciente (7 días): sesión (ORS/SRS) + cierre, ordenado por fecha.
    const feedbackReciente = [
      ...(fsRes.data || []).map((f) => ({ tipo: f.tipo, fecha: f.respondido_en, paciente: { nombre: nombreRel(f), user_id: userIdRel(f) } })),
      ...(ffRes.data || []).map((f) => ({ tipo: 'cierre', fecha: f.respondido_en, satisfaccion: f.satisfaccion, paciente: { nombre: nombreRel(f), user_id: userIdRel(f) } })),
    ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    res.json({
      kpis: {
        ingresos_cents_mes: ingresosCentsMes,
        sesiones_hechas_mes: sesionesHechasMes,
        no_shows_mes: noShowsMes,
        pacientes_activos: pacientesActivos,
      },
      hoy,
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
