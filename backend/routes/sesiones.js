const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin: crear sesión para un paciente
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { paciente_id, pack_id, fecha_hora, tipo, duracion_minutos } = req.body;
  if (!paciente_id || !fecha_hora || !tipo) {
    return res.status(400).json({ error: 'paciente_id, fecha_hora y tipo son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('sesiones')
      .insert({
        paciente_id,
        pack_id: pack_id || null,
        fecha_hora,
        tipo,
        duracion_minutos: duracion_minutos || 50,
        estado: 'programada',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: todas las sesiones (para el calendario)
router.get('/', verifyToken, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.query;

  try {
    let query = supabase
      .from('sesiones')
      .select(`
        id, fecha_hora, tipo, estado, duracion_minutos,
        pacientes ( users ( nombre_completo, email ) )
      `)
      .order('fecha_hora', { ascending: true });

    if (desde) query = query.gte('fecha_hora', desde);
    if (hasta) query = query.lte('fecha_hora', hasta);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: marcar sesión (completada / cancelada_con_cargo / cancelada)
router.put('/:id/estado', verifyToken, requireAdmin, async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ['programada', 'completada', 'cancelada', 'cancelada_con_cargo'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }

  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('estado, pack_id')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });

    const { data, error } = await supabase
      .from('sesiones')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Descontar del pack solo si la sesión estaba programada (evita doble descuento)
    const debeDescontar = (estado === 'completada' || estado === 'cancelada_con_cargo')
      && current.estado === 'programada'
      && data.pack_id;

    if (debeDescontar) {
      const { error: rpcError } = await supabase.rpc('incrementar_sesion_pack', { pack_uuid: data.pack_id });
      if (rpcError) console.error('incrementar_sesion_pack failed:', rpcError.message);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: reagendar sesión (nueva fecha, misma sesión)
router.put('/:id/reagendar', verifyToken, requireAdmin, async (req, res) => {
  const { fecha_hora } = req.body;
  if (!fecha_hora) return res.status(400).json({ error: 'fecha_hora es obligatorio' });

  try {
    const { data: current, error: fetchError } = await supabase
      .from('sesiones')
      .select('estado')
      .eq('id', req.params.id)
      .single();

    if (fetchError) return res.status(404).json({ error: 'Sesión no encontrada' });
    if (current.estado !== 'programada') {
      return res.status(400).json({ error: 'Solo se pueden reagendar sesiones programadas' });
    }

    const { data, error } = await supabase
      .from('sesiones')
      .update({ fecha_hora, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente: sus propias sesiones
router.get('/mis-sesiones', verifyToken, async (req, res) => {
  try {
    // Obtener paciente_id del user
    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data, error } = await supabase
      .from('sesiones')
      .select('id, fecha_hora, tipo, estado, duracion_minutos')
      .eq('paciente_id', paciente.id)
      .order('fecha_hora', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
