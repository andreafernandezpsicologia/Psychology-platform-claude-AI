const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Público: lista de documentos disponibles (título, tipo, versión)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documentos_legales')
      .select('id, titulo, tipo, version, created_at')
      .order('tipo');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente: ver qué documentos ha aceptado
// IMPORTANTE: debe estar antes de /:id para que Express no la capture como id="mis-aceptaciones"
router.get('/mis-aceptaciones', verifyToken, async (req, res) => {
  try {
    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data, error } = await supabase
      .from('aceptaciones_documentos')
      .select(`
        documento_id, aceptado, fecha_aceptacion,
        documentos_legales ( titulo, tipo, version )
      `)
      .eq('paciente_id', paciente.id);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Público: contenido completo de un documento
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documentos_legales')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente: registrar aceptación de un documento
router.post('/aceptar', verifyToken, async (req, res) => {
  const { documento_id } = req.body;
  if (!documento_id) {
    return res.status(400).json({ error: 'documento_id es obligatorio' });
  }

  try {
    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data, error } = await supabase
      .from('aceptaciones_documentos')
      .upsert({
        paciente_id: paciente.id,
        documento_id,
        aceptado: true,
        fecha_aceptacion: new Date().toISOString(),
      }, { onConflict: 'paciente_id,documento_id' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: insertar o actualizar un documento legal
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { titulo, contenido, tipo, version } = req.body;
  if (!titulo || !contenido || !tipo) {
    return res.status(400).json({ error: 'titulo, contenido y tipo son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('documentos_legales')
      .upsert({ titulo, contenido, tipo, version: version || 1 }, { onConflict: 'tipo' })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
