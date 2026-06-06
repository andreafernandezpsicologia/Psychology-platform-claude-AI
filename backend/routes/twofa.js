const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');

const router = express.Router();

// ── Helper: cookie de sesión (igual que en auth.js) ────────────────────────────
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('session', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 60 * 60 * 1000, // 1 hora
    path: '/',
  });
}

// ── POST /auth/2fa/verify ──────────────────────────────────────────────────────
// Segundo paso del login: verifica el código TOTP con el tempToken
router.post('/verify', async (req, res) => {
  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ error: 'Token temporal y código son obligatorios' });
  }

  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch {
    return res.status(400).json({ error: 'Token temporal inválido o expirado' });
  }

  if (decoded.type !== '2fa_pending') {
    return res.status(400).json({ error: 'Token no válido para este paso' });
  }

  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('id, email, role, nombre_completo, totp_secret, totp_enabled')
      .eq('id', decoded.id)
      .single();

    if (error || !userData?.totp_enabled || !userData?.totp_secret) {
      return res.status(400).json({ error: 'Error de configuración 2FA' });
    }

    const isValid = speakeasy.totp.verify({
      secret: userData.totp_secret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });

    if (!isValid) {
      await audit(req, '2fa_failed', 'auth', decoded.id, { reason: 'invalid_code' });
      return res.status(401).json({ error: 'Código incorrecto. Inténtalo de nuevo.' });
    }

    const sessionToken = jwt.sign(
      { id: userData.id, email: userData.email, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    setSessionCookie(res, sessionToken);
    await audit(req, 'login_2fa_success', 'auth', userData.id, { role: userData.role });

    res.json({
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        nombre_completo: userData.nombre_completo,
      },
    });
  } catch (err) {
    console.error('[2fa/verify]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /auth/2fa/setup ───────────────────────────────────────────────────────
// Genera un nuevo secreto TOTP y devuelve el QR (no lo activa aún)
router.post('/setup', verifyToken, requireAdmin, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Studio Renacer (${req.user.email})`,
      issuer: 'Studio Renacer',
      length: 20,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    const { error } = await supabase
      .from('users')
      .update({ totp_secret: secret.base32, totp_enabled: false })
      .eq('id', req.user.id);

    if (error) {
      console.error('[2fa/setup]', error.message);
      return res.status(500).json({ error: 'Error guardando configuración 2FA' });
    }

    res.json({ secret: secret.base32, qrCodeDataUrl });
  } catch (err) {
    console.error('[2fa/setup]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── POST /auth/2fa/verify-setup ───────────────────────────────────────────────
// Verifica que el código del QR es correcto y activa el 2FA
router.post('/verify-setup', verifyToken, requireAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'El código es obligatorio' });

  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('totp_secret')
      .eq('id', req.user.id)
      .single();

    if (error || !userData?.totp_secret) {
      return res.status(400).json({ error: 'Primero genera el QR desde /auth/2fa/setup' });
    }

    const isValid = speakeasy.totp.verify({
      secret: userData.totp_secret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Código incorrecto. Escanea de nuevo el QR e inténtalo.' });
    }

    await supabase
      .from('users')
      .update({ totp_enabled: true })
      .eq('id', req.user.id);

    await audit(req, '2fa_enabled', 'auth', req.user.id);
    res.json({ message: '2FA activado correctamente' });
  } catch (err) {
    console.error('[2fa/verify-setup]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /auth/2fa/status ──────────────────────────────────────────────────────
router.get('/status', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('totp_enabled')
      .eq('id', req.user.id)
      .single();

    if (error) return res.status(500).json({ error: 'Error obteniendo estado 2FA' });
    res.json({ totp_enabled: data.totp_enabled || false });
  } catch (err) {
    console.error('[2fa/status]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── DELETE /auth/2fa ──────────────────────────────────────────────────────────
// Desactiva el 2FA (requiere código válido como confirmación)
router.delete('/', verifyToken, requireAdmin, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Introduce tu código actual para desactivar 2FA' });

  try {
    const { data: userData, error } = await supabase
      .from('users')
      .select('totp_secret, totp_enabled')
      .eq('id', req.user.id)
      .single();

    if (error || !userData?.totp_enabled || !userData?.totp_secret) {
      return res.status(400).json({ error: '2FA no está activado' });
    }

    const isValid = speakeasy.totp.verify({
      secret: userData.totp_secret,
      encoding: 'base32',
      token: code.replace(/\s/g, ''),
      window: 1,
    });

    if (!isValid) {
      return res.status(401).json({ error: 'Código incorrecto' });
    }

    await supabase
      .from('users')
      .update({ totp_enabled: false, totp_secret: null })
      .eq('id', req.user.id);

    await audit(req, '2fa_disabled', 'auth', req.user.id);
    res.json({ message: '2FA desactivado correctamente' });
  } catch (err) {
    console.error('[2fa/delete]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
