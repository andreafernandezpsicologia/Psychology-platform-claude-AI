const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const supabase = require('../services/supabaseClient');
const supabaseAuth = require('../services/supabaseAuth');
const { sendWelcomeEmail } = require('../services/emailService');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── Rate limiter estricto para endpoints de autenticación ─────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo en 15 minutos.' },
  skipSuccessfulRequests: true, // solo cuenta intentos fallidos
});

// ── Helper: validar fortaleza de contraseña ──────────────────────────────────
function validatePassword(password) {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  return null;
}

// ── Registro inicial del admin ────────────────────────────────────────────────
// PROTEGIDO: requiere la clave de bootstrap en cabecera X-Bootstrap-Key
// Deshabilitar esta variable de entorno en producción una vez creada la cuenta
router.post('/admin-register', async (req, res) => {
  const bootstrapKey = req.headers['x-bootstrap-key'];
  if (!process.env.BOOTSTRAP_SECRET || bootstrapKey !== process.env.BOOTSTRAP_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }

  const { email, password, nombre } = req.body;
  if (!email || !password || !nombre) {
    return res.status(400).json({ error: 'Email, contraseña y nombre son obligatorios' });
  }
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

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
      { expiresIn: '1h' }
    );
    res.json({ token, user: { id: data.user.id, email, role: 'admin', nombre_completo: nombre } });
  } catch (err) {
    console.error('[admin-register]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Login (admin y paciente)
router.post('/login', authLimiter, async (req, res) => {
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
    if (userError) return res.status(400).json({ error: 'Error obteniendo datos de usuario' });

    const token = jwt.sign(
      { id: data.user.id, email, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({
      token,
      user: { id: data.user.id, email, role: userData.role, nombre_completo: userData.nombre_completo },
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
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

    // Token de activación (48 horas)
    const activationToken = jwt.sign(
      { id: data.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    // Enviar email de bienvenida con enlace de activación
    await sendWelcomeEmail(email, nombre, activationToken);

    res.json({ message: 'Invitación enviada', email });
  } catch (err) {
    console.error('[invitar-paciente]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Paciente activa su cuenta (establece contraseña)
router.post('/activar', authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
  }

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Actualizar contraseña en Supabase Auth
    const { error } = await supabase.auth.admin.updateUserById(decoded.id, {
      password,
      email_confirm: true,
    });
    if (error) return res.status(400).json({ error: 'No se pudo activar la cuenta' });

    const jwtToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: 'paciente' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
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
    if (error) return res.status(400).json({ error: 'No se pudieron obtener los datos del usuario' });
    res.json(data);
  } catch (err) {
    console.error('[me]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
