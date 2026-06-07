// ── Helpers de cookie de sesión — compartidos por auth.js y twofa.js ──────────
// Los atributos (secure, sameSite, path) DEBEN ser idénticos al crear y al
// borrar la cookie; si difieren, el navegador no la elimina al cerrar sesión.

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,                    // JS no puede leerla
    secure: isProd,                    // solo HTTPS en producción
    sameSite: isProd ? 'none' : 'lax', // 'none' para el proxy cross-origin Vercel→Render
    path: '/',
  };
}

function setSessionCookie(res, token) {
  res.cookie('session', token, { ...cookieOptions(), maxAge: 60 * 60 * 1000 }); // 1 hora
}

function clearSessionCookie(res) {
  // Mismos atributos que al crearla — imprescindible para que el navegador la borre
  res.clearCookie('session', cookieOptions());
}

module.exports = { setSessionCookie, clearSessionCookie };
