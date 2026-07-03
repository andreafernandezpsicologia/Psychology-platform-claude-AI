// Conexión OAuth con la cuenta de Google de Andrea para generar enlaces de
// Meet. Solo pide el scope calendar.events (crear/editar eventos): no puede
// leer correo, contactos ni nada más de la cuenta.
//
// Flujo: el admin pulsa "Conectar con Google" → /conectar devuelve la URL de
// consentimiento (con un state firmado anti-CSRF) → Google redirige a
// /callback → se guarda el refresh token en la tabla google_oauth → redirect
// de vuelta al calendario de la app.

const express = require('express');
const jwt = require('jsonwebtoken');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const meet = require('../services/googleMeetService');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// El proxy de Vercel reenvía /api/* al backend: el callback entra por el dominio del frontend
const REDIRECT_URI = `${FRONTEND_URL}/api/google/callback`;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events openid email';

// Estado de la integración (para pintar la UI de ajustes)
router.get('/estado', verifyToken, requireAdmin, async (req, res) => {
  try {
    const cuenta = await meet.cuentaConectada();
    res.json({
      configurado: meet.configurado(),
      conectado: !!cuenta,
      email: cuenta?.email || null,
    });
  } catch (err) {
    console.error('[google]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Devuelve la URL de consentimiento de Google
router.post('/conectar', verifyToken, requireAdmin, (req, res) => {
  if (!meet.configurado()) {
    return res.status(501).json({ error: 'no_configurado' });
  }
  // state firmado y de corta vida: el callback solo acepta flujos iniciados aquí
  const state = jwt.sign({ goauth: true }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: meet.CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent', // fuerza a Google a emitir refresh_token también en reconexiones
    state,
  });
  audit(req, 'google_oauth_start', 'google_oauth', null, {});
  res.json({ url });
});

// Callback de Google (llega por redirect del navegador, sin JWT de sesión:
// la autenticidad la da el state firmado)
router.get('/callback', async (req, res) => {
  const volver = (resultado) => res.redirect(`${FRONTEND_URL}/admin/calendario?google=${resultado}`);
  const { code, state, error } = req.query;

  if (error) return volver('error');
  try {
    jwt.verify(String(state || ''), process.env.JWT_SECRET);
  } catch {
    return volver('error');
  }
  if (!code) return volver('error');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: meet.CLIENT_ID,
        client_secret: meet.CLIENT_SECRET,
        code: String(code),
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      console.error('[google/callback] token:', tokenRes.status, (await tokenRes.text()).slice(0, 200));
      return volver('error');
    }
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      console.error('[google/callback] sin refresh_token en la respuesta');
      return volver('error');
    }

    // El email viene en el id_token (JWT de Google, recibido directo por TLS:
    // no hace falta verificar firma para un dato meramente informativo)
    let email = null;
    try {
      email = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()).email || null;
    } catch { /* sin email, no pasa nada */ }

    await meet.guardarRefreshToken(tokens.refresh_token, email);
    audit(req, 'google_oauth_connected', 'google_oauth', null, { email });
    volver('ok');
  } catch (err) {
    console.error('[google/callback]', err.message);
    volver('error');
  }
});

// Desconectar: revoca el token en Google y borra la fila
router.delete('/', verifyToken, requireAdmin, async (req, res) => {
  try {
    await meet.desconectar();
    audit(req, 'google_oauth_disconnected', 'google_oauth', null, {});
    res.json({ ok: true });
  } catch (err) {
    console.error('[google]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
