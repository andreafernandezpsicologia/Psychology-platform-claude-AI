const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Paciente: su propio perfil con sesiones y packs
// IMPORTANTE: debe estar antes de /:id para que Express no la capture como id="me"
router.get('/me/perfil', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, nombre_completo, telefono,
        pacientes (
          id, estado,
          packs ( id, num_sesiones_total, num_sesiones_usadas, estado, contrato_estado, contrato_path_paciente, contrato_path_admin ),
          sesiones ( id, fecha_hora, tipo, estado, duracion_minutos )
        )
      `)
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente: actualizar su teléfono
// IMPORTANTE: debe estar antes de /:pacienteId para que Express no la capture como pacienteId="me"
router.put('/me/telefono', verifyToken, async (req, res) => {
  const { telefono } = req.body;

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ telefono, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, telefono')
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: lista todos los pacientes con sus packs
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, nombre_completo, telefono, created_at,
        pacientes (
          id, estado, notas_admin,
          packs ( id, num_sesiones_total, num_sesiones_usadas, estado, created_at )
        )
      `)
      .eq('role', 'paciente')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: detalle de un paciente
router.get('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, nombre_completo, telefono, created_at,
        pacientes (
          id, estado, notas_admin,
          packs ( id, num_sesiones_total, num_sesiones_usadas, estado, estado_pago, contrato_estado, contrato_path_paciente, contrato_path_admin ),
          sesiones ( id, fecha_hora, tipo, estado, duracion_minutos )
        )
      `)
      .eq('id', req.params.id)
      .eq('role', 'paciente')
      .single();

    if (error) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: actualizar notas o estado de un paciente
router.put('/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  const { notas_admin, estado } = req.body;

  try {
    const updates = {};
    if (notas_admin !== undefined) updates.notas_admin = notas_admin;
    if (estado !== undefined) updates.estado = estado;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('pacientes')
      .update(updates)
      .eq('id', req.params.pacienteId)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: ver aceptación RGPD de un paciente (para descarga)
router.get('/:userId/rgpd', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data: paciente, error: pError } = await supabase
      .from('pacientes').select('id').eq('user_id', req.params.userId).single();
    if (pError) return res.status(404).json({ error: 'Paciente no encontrado' });

    // Traemos todas las aceptaciones con su documento y filtramos en JS
    // (.in sobre relaciones embebidas no funciona en PostgREST)
    const { data: aceptaciones, error } = await supabase
      .from('aceptaciones_documentos')
      .select('fecha_aceptacion, documentos_legales(titulo, tipo, version, contenido)')
      .eq('paciente_id', paciente.id)
      .order('fecha_aceptacion', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const tiposRgpd = ['consentimiento_informado', 'rgpd'];
    const aceptacion = aceptaciones?.find(a => tiposRgpd.includes(a.documentos_legales?.tipo));

    if (!aceptacion) return res.status(404).json({ error: 'No se encontró aceptación RGPD para este paciente' });
    res.json(aceptacion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: eliminar un paciente (borra de Auth y en cascada de todas las tablas)
router.delete('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
