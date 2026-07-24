const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendLanzamientoFormacion } = require('../services/emailService');

const router = express.Router();

// Programas que se pueden lanzar. 'todos' y 'general' no son lanzables:
// 'todos' es un interés (recibe el aviso de cada programa) y 'general' son
// altas de la guía de la landing principal (no consintieron avisos de programas).
const LANZABLES = ['calma', 'vinculos', 'raices'];

// ── Lista de espera de formaciones (admin) ───────────────────────────────────
// Devuelve las altas con sus avisos ya enviados, y un resumen por programa:
// cuánta gente hay interesada y cuántos están pendientes de recibir el aviso
// de lanzamiento de cada programa lanzable.
router.get('/waitlist', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('formaciones_waitlist')
      .select('id, created_at, nombre, email, telefono, idioma, source, programa, formaciones_waitlist_avisos ( programa, enviado_at )')
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });

    const rows = data || [];
    const interesados = {};   // programa de interés → nº de altas
    const pendientes = {};    // programa lanzable → nº que aún no recibió su aviso
    for (const p of LANZABLES) pendientes[p] = 0;
    for (const r of rows) {
      interesados[r.programa] = (interesados[r.programa] || 0) + 1;
      const avisados = new Set((r.formaciones_waitlist_avisos || []).map((a) => a.programa));
      for (const p of LANZABLES) {
        if ((r.programa === p || r.programa === 'todos') && !avisados.has(p)) pendientes[p]++;
      }
    }
    res.json({ rows, total: rows.length, interesados, pendientes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Enviar el aviso de lanzamiento de un programa ────────────────────────────
// Envía el email de lanzamiento a todas las altas interesadas en ese programa
// (o en 'todos') que aún no lo hayan recibido, y registra cada envío en
// formaciones_waitlist_avisos para no avisar dos veces a la misma persona.
router.post('/lanzamiento', verifyToken, requireAdmin, async (req, res) => {
  try {
    const programa = req.body?.programa;
    if (!LANZABLES.includes(programa)) {
      return res.status(400).json({ error: 'Programa inválido' });
    }

    const { data, error } = await supabase
      .from('formaciones_waitlist')
      .select('id, nombre, email, programa, formaciones_waitlist_avisos ( programa )')
      .in('programa', [programa, 'todos']);
    if (error) return res.status(400).json({ error: error.message });

    const destinatarios = (data || []).filter(
      (r) => !(r.formaciones_waitlist_avisos || []).some((a) => a.programa === programa)
    );

    let enviados = 0;
    const fallidos = [];
    for (const r of destinatarios) {
      try {
        await sendLanzamientoFormacion(r.email, r.nombre, programa);
        const { error: logErr } = await supabase
          .from('formaciones_waitlist_avisos')
          .insert({ waitlist_id: r.id, programa });
        if (logErr) console.error('[formaciones] aviso enviado pero no registrado:', r.email, logErr.message);
        enviados++;
      } catch (err) {
        console.error('[formaciones] error enviando a', r.email, err.message);
        fallidos.push(r.email);
      }
    }

    res.json({ programa, candidatos: destinatarios.length, enviados, fallidos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
