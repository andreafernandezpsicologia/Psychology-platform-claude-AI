const express = require('express');
const multer = require('multer');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { sendContratoEmail } = require('../services/emailService');
const { audit } = require('../services/auditLog');

const router = express.Router();

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Mapa MIME → extensión segura (nunca confiar en el nombre del archivo original)
const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido. Solo se aceptan PDF, Word e imágenes.'));
  },
});

// Obtener URL firmada para descargar un archivo del bucket contratos
async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from('contratos').createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

// ── GET plantilla del contrato (público para pacientes autenticados) ──────
router.get('/plantilla', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('documentos_legales')
      .select('id, titulo, contenido, version')
      .eq('tipo', 'contrato_servicios')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(data);
  } catch (err) {
    console.error('[contratos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST paciente sube contrato firmado ───────────────────────────────────
router.post('/pack/:packId/subir-paciente', verifyToken, upload.single('archivo'), async (req, res) => {
  const { packId } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  // Verificar que el pack pertenece al paciente autenticado
  const { data: paciente } = await supabase
    .from('pacientes').select('id').eq('user_id', req.user.id).single();

  if (!paciente) return res.status(403).json({ error: 'Acceso denegado' });

  const { data: pack } = await supabase
    .from('packs').select('id').eq('id', packId).eq('paciente_id', paciente.id).single();

  if (!pack) return res.status(403).json({ error: 'Pack no encontrado o no autorizado' });

  try {
    const ext = MIME_TO_EXT[file.mimetype] || 'bin';
    const storagePath = `${packId}/firmado_paciente.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('contratos')
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) return res.status(400).json({ error: 'Error subiendo el archivo' });

    await supabase.from('packs').update({
      contrato_estado: 'firmado_paciente',
      contrato_path_paciente: storagePath,
      contrato_fecha_paciente: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', packId);

    res.json({ message: 'Contrato subido correctamente' });
  } catch (err) {
    console.error('[subir-paciente]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST admin envía el contrato predeterminado al paciente por email ─────
// Deja el pack en contrato_estado='enviado': así el paciente ve en su área el
// predeterminado para firmar SOLO cuando Andrea eligió ese camino (si el
// contrato se firmó en papel, ella sube el escaneo y nunca pasa por aquí).
router.post('/pack/:packId/enviar-plantilla', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data: pack, error: packError } = await supabase
      .from('packs')
      .select('id, contrato_estado, pacientes ( user_id, users ( email, nombre_completo, idioma_preferido ) )')
      .eq('id', req.params.packId)
      .single();
    if (packError || !pack) return res.status(404).json({ error: 'Pack no encontrado' });

    const user = pack.pacientes?.users;
    if (!user?.email) return res.status(404).json({ error: 'Paciente no encontrado' });

    await sendContratoEmail(user.email, user.nombre_completo, user.idioma_preferido);

    // No degradar un contrato ya firmado: solo sin_contrato → enviado
    if (!pack.contrato_estado || pack.contrato_estado === 'sin_contrato') {
      await supabase.from('packs')
        .update({ contrato_estado: 'enviado', updated_at: new Date().toISOString() })
        .eq('id', pack.id);
    }

    audit(req, 'send_contract_template', 'packs', pack.id);
    res.json({ message: 'Contrato enviado', email: user.email });
  } catch (err) {
    console.error('[enviar-plantilla]', err.message);
    res.status(500).json({ error: 'No se pudo enviar el contrato' });
  }
});

// ── POST admin sube contrato firmado por ambas partes ─────────────────────
router.post('/pack/:packId/subir-admin', verifyToken, requireAdmin, upload.single('archivo'), async (req, res) => {
  const { packId } = req.params;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  try {
    const ext = MIME_TO_EXT[file.mimetype] || 'bin';
    const storagePath = `${packId}/firmado_admin.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('contratos')
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadError) return res.status(400).json({ error: 'Error subiendo el archivo' });

    await supabase.from('packs').update({
      contrato_estado: 'completado',
      contrato_path_admin: storagePath,
      contrato_fecha_admin: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', packId);

    res.json({ message: 'Contrato definitivo subido correctamente' });
  } catch (err) {
    console.error('[subir-admin]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET descarga contrato firmado por paciente (admin o el propio paciente) ─
router.get('/pack/:packId/firmado-paciente', verifyToken, async (req, res) => {
  try {
    const { data: paciente } = await supabase
      .from('pacientes').select('id').eq('user_id', req.user.id).single();

    const { data: pack } = await supabase
      .from('packs').select('contrato_path_paciente, paciente_id').eq('id', req.params.packId).single();

    if (!pack) return res.status(404).json({ error: 'Pack no encontrado' });
    if (req.user.role !== 'admin' && pack.paciente_id !== paciente?.id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!pack.contrato_path_paciente) return res.status(404).json({ error: 'Contrato del paciente no encontrado' });

    const url = await getSignedUrl(pack.contrato_path_paciente);
    if (!url) return res.status(500).json({ error: 'Error generando URL de descarga' });

    res.json({ url });
  } catch (err) {
    console.error('[contratos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET paciente descarga contrato definitivo (firmado por ambos) ─────────
router.get('/pack/:packId/firmado-admin', verifyToken, async (req, res) => {
  try {
    // Verificar que el pack pertenece al paciente
    const { data: paciente } = await supabase
      .from('pacientes').select('id').eq('user_id', req.user.id).single();

    const { data: pack } = await supabase
      .from('packs').select('contrato_path_admin, paciente_id').eq('id', req.params.packId).single();

    if (!pack) return res.status(404).json({ error: 'Pack no encontrado' });
    if (req.user.role !== 'admin' && pack.paciente_id !== paciente?.id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (!pack.contrato_path_admin) return res.status(404).json({ error: 'Contrato definitivo no disponible aún' });

    const url = await getSignedUrl(pack.contrato_path_admin);
    if (!url) return res.status(500).json({ error: 'Error generando URL de descarga' });

    res.json({ url });
  } catch (err) {
    console.error('[contratos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
