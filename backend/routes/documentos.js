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
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paciente: ¿debe aceptar el consentimiento vigente antes de entrar?
// Puerta de consentimiento: el frontend bloquea el acceso del paciente hasta que
// conste una aceptación del documento de consentimiento vigente, de modo que todo
// paciente real deje registro de su consentimiento (RGPD Art. 7.1).
// IMPORTANTE: debe ir antes de /:id para que Express no la capture como id.
router.get('/consentimiento-requerido', verifyToken, async (req, res) => {
  try {
    const { data: docs, error: dErr } = await supabase
      .from('documentos_legales')
      .select('id, titulo, contenido, version, tipo')
      .in('tipo', ['consentimiento_informado', 'rgpd']);
    if (dErr) return res.status(400).json({ error: dErr.message });

    const doc = (docs || []).find((d) => d.tipo === 'consentimiento_informado')
      || (docs || []).find((d) => d.tipo === 'rgpd');
    // Sin documento no se puede registrar aceptación: no bloquear.
    if (!doc) return res.json({ requerido: false, documento: null });

    // Solo aplica a pacientes; cualquier otro rol pasa sin requisito.
    const { data: paciente } = await supabase
      .from('pacientes').select('id').eq('user_id', req.user.id).maybeSingle();
    if (!paciente) return res.json({ requerido: false, documento: null });

    const { data: aceptacion } = await supabase
      .from('aceptaciones_documentos')
      .select('aceptado')
      .eq('paciente_id', paciente.id)
      .eq('documento_id', doc.id)
      .eq('aceptado', true)
      .maybeSingle();

    const requerido = !aceptacion;
    res.json({
      requerido,
      documento: requerido
        ? { id: doc.id, titulo: doc.titulo, contenido: doc.contenido, version: doc.version }
        : null,
    });
  } catch (err) {
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('[documentos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
