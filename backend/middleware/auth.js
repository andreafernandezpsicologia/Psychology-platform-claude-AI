const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Leer de cookie httpOnly (preferido) o header Authorization (compatibilidad)
  const token = req.cookies?.session || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Solo los tokens de SESIÓN llevan `role`. Los tokens temporales
    // (2fa_pending, password_reset, activación) NO deben dar acceso aquí.
    if (!payload.role) {
      return res.status(401).json({ error: 'Token no válido para esta sesión' });
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada. Inicia sesión de nuevo.' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { verifyToken, requireAdmin };
