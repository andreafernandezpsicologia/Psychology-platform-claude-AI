const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { aParedMadrid } = require('../services/fechaPared');

const router = express.Router();

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
  const { sesion_id, tipo, valores } = req.body;

  if (!['ors', 'srs'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });
  if (!Array.isArray(valores) || valores.length !== 4 || valores.some((v) => typeof v !== 'number' || v < 0 || v > 10)) {
    return res.status(400).json({ error: 'valores debe ser un array de 4 números entre 0 y 10' });
  }

  try {
    const pacienteId = await pacienteIdDe(req.user.id);
    if (!pacienteId) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data: sesion, error: sErr } = await supabase
      .from('sesiones').select('id, paciente_id').eq('id', sesion_id).single();
    if (sErr || !sesion) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (sesion.paciente_id !== pacienteId) return res.status(403).json({ error: 'No autorizado' });

    const redondeados = valores.map((v) => Math.round(v * 10) / 10);
    const total = Math.round(redondeados.reduce((a, b) => a + b, 0) * 10) / 10;

    const { data, error } = await supabase.from('feedback_sesiones').insert({
      paciente_id: pacienteId,
      sesion_id,
      tipo,
      p1: redondeados[0], p2: redondeados[1], p3: redondeados[2], p4: redondeados[3],
      total,
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
      .select('id, tipo, p1, p2, p3, p4, total, creado_en, sesiones ( fecha_hora )')
      .eq('paciente_id', req.params.pacienteId)
      .order('creado_en', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'view_feedback', 'feedback', req.params.pacienteId);
    res.json(data);
  } catch (err) {
    console.error('[feedback]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
