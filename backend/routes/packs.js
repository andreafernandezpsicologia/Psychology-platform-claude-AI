const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin: crear un pack de sesiones para un paciente
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { paciente_id, num_sesiones_total } = req.body;
  if (!paciente_id || !num_sesiones_total) {
    return res.status(400).json({ error: 'paciente_id y num_sesiones_total son obligatorios' });
  }

  try {
    const { data, error } = await supabase
      .from('packs')
      .insert({
        paciente_id,
        num_sesiones_total,
        num_sesiones_usadas: 0,
        estado: 'activo',
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: historial de packs de un paciente
router.get('/paciente/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('paciente_id', req.params.pacienteId)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente: sus propios packs
router.get('/mis-packs', verifyToken, async (req, res) => {
  try {
    const { data: paciente, error: pError } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', req.user.id)
      .single();

    if (pError) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });

    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: eliminar un pack (solo si no tiene sesiones asociadas)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { count, error: countError } = await supabase
      .from('sesiones')
      .select('id', { count: 'exact', head: true })
      .eq('pack_id', req.params.id);

    if (countError) return res.status(400).json({ error: countError.message });
    if (count > 0) {
      return res.status(409).json({ error: 'No se puede eliminar un pack con sesiones asociadas' });
    }

    const { error } = await supabase
      .from('packs')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Pack eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: actualizar estado de pago
router.put('/:id/pago', verifyToken, requireAdmin, async (req, res) => {
  const { estado_pago } = req.body;
  const valid = ['no_pagado', 'pago_parcial', 'pagado'];
  if (!valid.includes(estado_pago)) {
    return res.status(400).json({ error: 'estado_pago inválido' });
  }
  try {
    const { data, error } = await supabase
      .from('packs')
      .update({ estado_pago, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select().single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: cerrar un pack manualmente
router.put('/:id/completar', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('packs')
      .update({ estado: 'completado', updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
