const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

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
          id, estado, pago_online_habilitado,
          packs ( id, num_sesiones_total, num_sesiones_usadas, estado, estado_pago, precio_cents, num_cuotas, contrato_estado, contrato_path_paciente, contrato_path_admin,
            cuotas_pack ( id, numero, importe_cents, fecha_limite, estado_pago ) ),
          sesiones ( id, fecha_hora, tipo, estado, duracion_minutos, enlace_videollamada, pack_id, estado_pago, precio_cents )
        )
      `)
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    audit(req, 'view_own_profile', 'patients', req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
    audit(req, 'list_patients', 'patients');
    res.json(data);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
          id, estado, notas_admin, pago_online_habilitado,
          packs ( id, num_sesiones_total, num_sesiones_usadas, estado, estado_pago, precio_cents, fecha_pago, num_cuotas, contrato_estado, contrato_path_paciente, contrato_path_admin,
            cuotas_pack ( id, numero, importe_cents, fecha_limite, estado_pago, fecha_pago ) ),
          sesiones ( id, fecha_hora, tipo, estado, duracion_minutos, enlace_videollamada, pack_id, estado_pago, precio_cents, fecha_pago )
        )
      `)
      .eq('id', req.params.id)
      .eq('role', 'paciente')
      .single();

    if (error) return res.status(404).json({ error: 'Paciente no encontrado' });
    audit(req, 'view_patient', 'patients', req.params.id);
    res.json(data);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: actualizar notas o estado de un paciente
router.put('/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  const { notas_admin, estado, pago_online_habilitado } = req.body;

  try {
    const updates = {};
    if (notas_admin !== undefined) updates.notas_admin = notas_admin;
    if (estado !== undefined) updates.estado = estado;
    if (pago_online_habilitado !== undefined) updates.pago_online_habilitado = !!pago_online_habilitado;
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
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reúne todos los datos de un paciente para la exportación RGPD Art. 20.
// Una sola definición para el self-export del paciente y el export de admin, así
// el formato no diverge (un export que omita datos sería un fallo de cumplimiento).
// Devuelve { status, error } si falta usuario/paciente, o { datos } con el payload.
async function construirExportPaciente(userId, { incluirNotasAdmin = false } = {}) {
  const { data: user, error: uError } = await supabase
    .from('users')
    .select('id, email, nombre_completo, telefono, created_at')
    .eq('id', userId)
    .single();
  if (uError) return { status: 404, error: 'Usuario no encontrado' };

  const { data: paciente, error: pError } = await supabase
    .from('pacientes')
    .select(incluirNotasAdmin ? 'id, estado, notas_admin' : 'id, estado')
    .eq('user_id', userId)
    .single();
  if (pError) return { status: 404, error: 'Paciente no encontrado' };

  const [{ data: sesiones }, { data: packs }, { data: documentos }, { data: aceptaciones }] = await Promise.all([
    supabase.from('sesiones')
      .select('id, fecha_hora, tipo, estado, duracion_minutos, estado_pago, precio_cents, fecha_pago, created_at')
      .eq('paciente_id', paciente.id)
      .order('fecha_hora', { ascending: true }),
    supabase.from('packs')
      .select('id, num_sesiones_total, num_sesiones_usadas, estado, estado_pago, precio_cents, fecha_pago, created_at')
      .eq('paciente_id', paciente.id),
    supabase.from('documentos')
      .select('id, nombre, tipo, created_at')
      .eq('paciente_id', paciente.id),
    supabase.from('aceptaciones_documentos')
      .select('fecha_aceptacion, titulo_aceptado, version_aceptada, documentos_legales(titulo, tipo, version)')
      .eq('paciente_id', paciente.id)
      .order('fecha_aceptacion', { ascending: false }),
  ]);

  // Preferir el snapshot tomado al aceptar (RGPD Art. 7); las aceptaciones
  // anteriores a jul-2026 no tienen snapshot y muestran el documento vigente.
  const consentimientos = (aceptaciones || []).map(({ titulo_aceptado, version_aceptada, ...a }) => ({
    ...a,
    documentos_legales: a.documentos_legales && {
      ...a.documentos_legales,
      titulo: titulo_aceptado || a.documentos_legales.titulo,
      version: version_aceptada ?? a.documentos_legales.version,
    },
  }));

  const datos = {
    exportado_en: new Date().toISOString(),
    responsable: 'Studio Renacer — Andrea Fernández (colegiada 27327)',
    base_legal: 'RGPD Art. 20 — Derecho a la portabilidad de los datos',
    datos_personales: user,
    estado_cuenta: paciente.estado,
    ...(incluirNotasAdmin ? { notas_admin: paciente.notas_admin } : {}),
    sesiones: sesiones || [],
    packs: packs || [],
    documentos: documentos || [],
    consentimientos,
  };
  return { datos };
}

// Paciente: exportar sus propios datos (RGPD Art. 20 — portabilidad)
// IMPORTANTE: debe estar antes de /:userId/export para que Express no capture "me" como userId
router.get('/me/export', verifyToken, async (req, res) => {
  try {
    const { status, error, datos } = await construirExportPaciente(req.user.id);
    if (error) return res.status(status).json({ error });

    await audit(req, 'export_own_data', 'patients', req.user.id);

    res.setHeader('Content-Disposition', `attachment; filename="mis-datos-studio-renacer-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(datos);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: exportar todos los datos de un paciente (RGPD Art. 20)
router.get('/:userId/export', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { status, error, datos } = await construirExportPaciente(req.params.userId, { incluirNotasAdmin: true });
    if (error) return res.status(status).json({ error });

    await audit(req, 'export_patient_data', 'patients', req.params.userId);

    res.setHeader('Content-Disposition', `attachment; filename="datos-paciente-${req.params.userId.slice(0,8)}-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(datos);
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
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
      .select('fecha_aceptacion, titulo_aceptado, version_aceptada, contenido_aceptado, documentos_legales(titulo, tipo, version, contenido)')
      .eq('paciente_id', paciente.id)
      .order('fecha_aceptacion', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const tiposRgpd = ['consentimiento_informado', 'rgpd'];
    const aceptacion = aceptaciones?.find(a => tiposRgpd.includes(a.documentos_legales?.tipo));

    if (!aceptacion) return res.status(404).json({ error: 'No se encontró aceptación RGPD para este paciente' });

    // Preferir el snapshot tomado al aceptar (RGPD Art. 7): es el texto exacto
    // que el paciente vio. Sin snapshot (aceptaciones pre jul-2026) se devuelve
    // el documento vigente y se indica que la evidencia primaria es la firma
    // en papel.
    const { titulo_aceptado, version_aceptada, contenido_aceptado, ...resto } = aceptacion;
    res.json({
      ...resto,
      documentos_legales: {
        ...aceptacion.documentos_legales,
        titulo: titulo_aceptado || aceptacion.documentos_legales.titulo,
        version: version_aceptada ?? aceptacion.documentos_legales.version,
        contenido: contenido_aceptado || aceptacion.documentos_legales.contenido,
      },
      evidencia: contenido_aceptado
        ? 'snapshot_en_aceptacion'
        : 'documento_vigente_sin_snapshot (aceptación anterior a jul-2026; evidencia primaria: firma en papel)',
    });
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: eliminar un paciente (borra de Auth y en cascada de todas las tablas)
router.delete('/:userId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.userId);
    if (error) return res.status(400).json({ error: error.message });
    // Registrar eliminación — RGPD Art. 17 (derecho al olvido)
    await audit(req, 'delete_patient', 'patients', req.params.userId, { reason: 'admin_action' });
    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (err) {
    console.error('[pacientes]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
