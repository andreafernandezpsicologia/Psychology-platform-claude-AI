const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const supabase = require('../services/supabaseClient');
const supabaseAuth = require('../services/supabaseAuth');
const { sendWelcomeEmail } = require('../services/emailService');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Registro inicial del admin (solo se usa una vez para crear tu cuenta)
router.post('/admin-register', async (req, res) => {
  const { email, password, nombre } = req.body;
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
  }

  try {
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: dbError } = await supabase.from('users').insert({
      id: data.user.id,
      email,
      role: 'admin',
      nombre_completo: nombre,
    });
    if (dbError) return res.status(400).json({ error: dbError.message });

    const token = jwt.sign(
      { id: data.user.id, email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: data.user.id, email, role: 'admin', nombre_completo: nombre } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login (admin y paciente)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
  }

  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: 'Credenciales incorrectas' });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, nombre_completo')
      .eq('id', data.user.id)
      .single();
    if (userError) return res.status(400).json({ error: userError.message });

    const token = jwt.sign(
      { id: data.user.id, email, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: data.user.id, email, role: userData.role, nombre_completo: userData.nombre_completo },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin invita a un paciente (crea cuenta y envía email de activación)
router.post('/invitar-paciente', verifyToken, requireAdmin, async (req, res) => {
  const { email, nombre } = req.body;
  if (!email || !nombre) {
    return res.status(400).json({ error: 'Email y nombre son obligatorios' });
  }

  try {
    // Crear usuario en Supabase Auth (sin contraseña — la establece el paciente al activar)
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    // Insertar en tabla users
    const { error: userError } = await supabase.from('users').insert({
      id: data.user.id,
      email,
      role: 'paciente',
      nombre_completo: nombre,
    });
    if (userError) return res.status(400).json({ error: userError.message });

    // Crear perfil paciente
    await supabase.from('pacientes').insert({ user_id: data.user.id });

    // Token de activación (7 días)
    const activationToken = jwt.sign(
      { id: data.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Enviar email de bienvenida con enlace de activación
    await sendWelcomeEmail(email, nombre, activationToken);

    res.json({ message: 'Invitación enviada', email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Paciente activa su cuenta (establece contraseña)
router.post('/activar', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Actualizar contraseña en Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(decoded.id, {
      password,
      email_confirm: true,
    });
    if (error) return res.status(400).json({ error: error.message });

    const jwtToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: 'paciente' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token: jwtToken, message: 'Cuenta activada correctamente' });
  } catch {
    res.status(400).json({ error: 'Token inválido o expirado' });
  }
});

// Obtener datos del usuario autenticado
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, nombre_completo, telefono, created_at')
      .eq('id', req.user.id)
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
