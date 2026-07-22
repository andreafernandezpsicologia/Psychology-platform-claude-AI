const crypto = require('node:crypto');
const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { aParedMadrid } = require('../services/fechaPared');
const { validarRespuestas } = require('../config/feedbackPreguntas');
const { sendFinalFeedbackEmail } = require('../services/emailService');

const router = express.Router();

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://app.studiorenacer.com';
}

// Ventana de "reciente" para ofrecer feedback: una sesión completada sigue
// pidiendo SRS hasta 7 días después; una próxima sesión pide ORS desde ya.
const DIAS_VENTANA_SRS = 7;

async function pacienteIdDe(userId) {
  const { data, error } = await supabase.from('pacientes').select('id').eq('user_id', userId).single();
  if (error) return null;
  return data.id;
}

// ── Paciente: qué feedback tiene pendiente ───────────────────────────────────
// { srs_pendiente: sesion|null, ors_pendiente: sesion|null }
router.get('/pendiente', verifyToken, async (req, res) => {
  if (req.user.role !== 'paciente') return res.status(403).json({ error: 'Solo para pacientes' });

  try {
    const pacienteId = await pacienteIdDe(req.user.id);
    if (!pacienteId) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const ahora = aParedMadrid(new Date());
    const desdeSrs = aParedMadrid(new Date(Date.now() - DIAS_VENTANA_SRS * 86400000));

    const [{ data: sesiones, error: sErr }, { data: existentes, error: fErr }] = await Promise.all([
      supabase.from('sesiones')
        .select('id, fecha_hora, tipo, estado')
        .eq('paciente_id', pacienteId)
        .in('estado', ['programada', 'completada']),
      supabase.from('feedback_sesiones').select('sesion_id, tipo').eq('paciente_id', pacienteId),
    ]);
    if (sErr) return res.status(400).json({ error: sErr.message });
    if (fErr) return res.status(400).json({ error: fErr.message });

    const yaTiene = (sesionId, tipo) => (existentes || []).some((f) => f.sesion_id === sesionId && f.tipo === tipo);

    // SRS: la sesión completada más reciente (dentro de la ventana) sin SRS.
    const srsCandidatas = (sesiones || [])
      .filter((s) => s.estado === 'completada' && s.fecha_hora >= desdeSrs && !yaTiene(s.id, 'srs'))
      .sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));

    // ORS: la próxima sesión programada más cercana sin ORS.
    const orsCandidatas = (sesiones || [])
      .filter((s) => s.estado === 'programada' && s.fecha_hora >= ahora && !yaTiene(s.id, 'ors'))
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

    res.json({
      srs_pendiente: srsCandidatas[0] || null,
      ors_pendiente: orsCandidatas[0] || null,
    });
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Paciente: enviar su feedback (ORS o SRS) de una sesión propia ───────────
router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'paciente') return res.status(403).json({ error: 'Solo para pacientes' });
  const { sesion_id, tipo, respuestas } = req.body;

  if (!['ors', 'srs'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
  const val = validarRespuestas(tipo, respuestas);
  if (!val.ok) return res.status(400).json({ error: val.error });

  try {
    const pacienteId = await pacienteIdDe(req.user.id);
    if (!pacienteId) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data: sesion, error: sErr } = await supabase
      .from('sesiones').select('id, paciente_id').eq('id', sesion_id).single();
    if (sErr || !sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (sesion.paciente_id !== pacienteId) return res.status(403).json({ error: 'No autorizado' });

    const { data, error } = await supabase.from('feedback_sesiones').insert({
      paciente_id: pacienteId,
      sesion_id,
      tipo,
      respuestas: val.limpio,
    }).select().single();

    if (error) {
      // 23505 = ya existe feedback de este tipo para esta sesión (unique sesion_id+tipo)
      if (error.code === '23505') return res.status(409).json({ error: 'Ya has enviado este feedback' });
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Admin: serie temporal de un paciente (para la gráfica) ──────────────────
router.get('/paciente/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback_sesiones')
      .select('id, tipo, respuestas, creado_en, sesiones ( fecha_hora )')
      .eq('paciente_id', req.params.pacienteId)
      .order('creado_en', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'view_feedback', 'feedback', req.params.pacienteId);
    res.json(data);
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ═══ Cuestionario de fin de terapia ═════════════════════════════════════════

// ── Admin: enviar el cuestionario de cierre a un paciente ───────────────────
router.post('/final/enviar/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data: paciente, error: pErr } = await supabase
      .from('pacientes')
      .select('id, users ( email, nombre_completo, idioma_preferido )')
      .eq('id', req.params.pacienteId).single();
    if (pErr || !paciente) return res.status(404).json({ error: 'Paciente no encontrado' });
    const user = paciente.users;
    if (!user?.email) return res.status(400).json({ error: 'El paciente no tiene email' });

    const token = crypto.randomBytes(32).toString('hex');
    const { data, error } = await supabase.from('feedback_final')
      .insert({ paciente_id: paciente.id, token })
      .select('id, enviado_en').single();
    if (error) return res.status(400).json({ error: error.message });

    const enlace = `${frontendUrl()}/cuestionario/${token}`;
    try {
      await sendFinalFeedbackEmail(user.email, user.nombre_completo, enlace, user.idioma_preferido);
    } catch (mailErr) {
      console.error('[feedback final] email:', mailErr.message);
      return res.status(502).json({ error: 'No se pudo enviar el email' });
    }

    audit(req, 'send_final_feedback', 'feedback', paciente.id);
    res.status(201).json({ ok: true, enviado_en: data.enviado_en });
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Público (token): estado del cuestionario, para pintar el formulario ─────
router.get('/final/:token', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback_final')
      .select('respondido_en, pacientes ( users ( nombre_completo ) )')
      .eq('token', req.params.token).single();
    // 404 genérico: no revelar si el token existe o no cuando falta/está mal.
    if (error || !data) return res.status(404).json({ error: 'Cuestionario no encontrado' });
    res.json({
      respondido: !!data.respondido_en,
      nombre: data.pacientes?.users?.nombre_completo?.split(' ')[0] || null,
    });
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Público (token): enviar las respuestas (una sola vez) ───────────────────
router.post('/final/:token', async (req, res) => {
  const { satisfaccion, recomendaria, que_ayudo, que_mejorar, como_te_vas } = req.body;
  const escala = (v) => (v === undefined || v === null ? null : (Number.isInteger(v) && v >= 0 && v <= 10 ? v : NaN));
  const s = escala(satisfaccion);
  const r = escala(recomendaria);
  if (Number.isNaN(s) || Number.isNaN(r)) return res.status(400).json({ error: 'valores de escala inválidos' });

  try {
    const { data: fila, error: fErr } = await supabase
      .from('feedback_final').select('id, respondido_en').eq('token', req.params.token).single();
    if (fErr || !fila) return res.status(404).json({ error: 'Cuestionario no encontrado' });
    if (fila.respondido_en) return res.status(409).json({ error: 'Este cuestionario ya fue respondido' });

    // Guardado idempotente: solo la actualización que pasa respondido_en de NULL
    // a ahora tiene efecto (evita doble envío por doble clic).
    const { data, error } = await supabase.from('feedback_final')
      .update({
        satisfaccion: s, recomendaria: r,
        que_ayudo: (que_ayudo || '').slice(0, 4000) || null,
        que_mejorar: (que_mejorar || '').slice(0, 4000) || null,
        como_te_vas: (como_te_vas || '').slice(0, 4000) || null,
        respondido_en: new Date().toISOString(),
      })
      .eq('token', req.params.token)
      .is('respondido_en', null)
      .select('id');
    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(409).json({ error: 'Este cuestionario ya fue respondido' });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Admin: cuestionarios de cierre de un paciente (enviados y respondidos) ──
router.get('/final/paciente/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback_final')
      .select('id, enviado_en, respondido_en, satisfaccion, recomendaria, que_ayudo, que_mejorar, como_te_vas')
      .eq('paciente_id', req.params.pacienteId)
      .order('enviado_en', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    audit(req, 'view_final_feedback', 'feedback', req.params.pacienteId);
    res.json(data);
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
