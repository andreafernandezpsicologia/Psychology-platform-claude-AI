const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const supabase = require('../services/supabaseClient');
const supabaseAuth = require('../services/supabaseAuth');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/emailService');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { setSessionCookie, clearSessionCookie } = require('../services/sessionCookie');

const router = express.Router();

// ── Rate limiter estricto para endpoints de autenticación ─────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Inténtalo en 15 minutos.' },
  skipSuccessfulRequests: true,
});

// ── Helper: validar fortaleza de contraseña ───────────────────────────────────
function validatePassword(password) {
  if (!password || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe contener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe contener al menos un número';
  return null;
}

// ── Registro inicial del admin ────────────────────────────────────────────────
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
      email, password, email_confirm: true,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: dbError } = await supabase.from('users').insert({
      id: data.user.id, email, role: 'admin', nombre_completo: nombre,
    });
    if (dbError) return res.status(400).json({ error: dbError.message });

    const token = jwt.sign(
      { id: data.user.id, email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    setSessionCookie(res, token);
    res.json({ user: { id: data.user.id, email, role: 'admin', nombre_completo: nombre } });
  } catch (err) {
    console.error('[admin-register]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Login (admin y paciente) ──────────────────────────────────────────────────
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
      .select('role, nombre_completo, totp_enabled')
      .eq('id', data.user.id)
      .single();
    if (userError) return res.status(400).json({ error: 'Error obteniendo datos de usuario' });

    // ── 2FA: si el admin tiene 2FA activo, no emitir cookie todavía ─────────────
    if (userData.role === 'admin' && userData.totp_enabled) {
      const tempToken = jwt.sign(
        { id: data.user.id, email, type: '2fa_pending' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      await audit(req, 'login_2fa_required', 'auth', data.user.id);
      return res.json({ require2fa: true, tempToken });
    }

    const token = jwt.sign(
      { id: data.user.id, email, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    setSessionCookie(res, token);
    await audit(req, 'login', 'auth', data.user.id, { role: userData.role });
    res.json({
      user: { id: data.user.id, email, role: userData.role, nombre_completo: userData.nombre_completo },
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  audit(req, 'logout', 'auth');
  clearSessionCookie(res);
  res.json({ message: 'Sesión cerrada' });
});

// ── Admin invita a un paciente ────────────────────────────────────────────────
router.post('/invitar-paciente', verifyToken, requireAdmin, async (req, res) => {
  const { email, nombre } = req.body;
  if (!email || !nombre) {
    return res.status(400).json({ error: 'Email y nombre son obligatorios' });
  }

  try {
    const { data, error: authError } = await supabase.auth.admin.createUser({
      email, email_confirm: false,
    });
    if (authError) return res.status(400).json({ error: authError.message });

    const { error: userError } = await supabase.from('users').insert({
      id: data.user.id, email, role: 'paciente', nombre_completo: nombre,
    });
    if (userError) return res.status(400).json({ error: userError.message });

    await supabase.from('pacientes').insert({ user_id: data.user.id });

    const activationToken = jwt.sign(
      { id: data.user.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    await sendWelcomeEmail(email, nombre, activationToken);
    res.json({ message: 'Invitación enviada', email });
  } catch (err) {
    console.error('[invitar-paciente]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Activar cuenta (paciente establece contraseña) ───────────────────────────
router.post('/activar', authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son obligatorios' });
  }

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { error } = await supabase.auth.admin.updateUserById(decoded.id, {
      password, email_confirm: true,
    });
    if (error) return res.status(400).json({ error: 'No se pudo activar la cuenta' });

    const jwtToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: 'paciente' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    setSessionCookie(res, jwtToken);
    res.json({ message: 'Cuenta activada correctamente' });
  } catch {
    res.status(400).json({ error: 'Token inválido o expirado' });
  }
});

// ── Olvidé mi contraseña ──────────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email obligatorio' });

  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, nombre_completo')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Responder siempre igual para no revelar si el email existe
    if (error || !userData) {
      return res.json({ message: 'Si el email existe, recibirás un enlace en breve.' });
    }

    const resetToken = jwt.sign(
      { id: userData.id, email: email.toLowerCase().trim(), type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await sendPasswordResetEmail(email, userData.nombre_completo, resetToken);
    res.json({ message: 'Si el email existe, recibirás un enlace en breve.' });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── Restablecer contraseña (desde el enlace del email) ────────────────────────
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token y contraseña obligatorios' });

  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Token no válido para este uso' });
    }

    const { error } = await supabase.auth.admin.updateUserById(decoded.id, { password });
    if (error) return res.status(400).json({ error: 'No se pudo actualizar la contraseña' });

    await audit(req, 'password_reset', 'auth', decoded.id);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch {
    res.status(400).json({ error: 'El enlace no es válido o ha expirado' });
  }
});

// ── Datos del usuario autenticado ─────────────────────────────────────────────
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
