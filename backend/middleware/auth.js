const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  // Leer de cookie httpOnly (preferido) o header Authorization (compatibilidad)
  const token = req.cookies?.session || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Autenticación requerida' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
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
