const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Cabeceras de seguridad (NIS2 / RGPD Art. 25) ─────────────────────────────
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'https://studiorenacer.com',
  'https://www.studiorenacer.com',
  'https://app.studiorenacer.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Rechazar peticiones sin Origin en producción
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return cb(new Error('CORS: origen requerido en producción'));
      }
      return cb(null, true); // permitir solo en desarrollo
    }
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: origen no permitido'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ── Rate limiting global ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
});
app.use('/api', globalLimiter);

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/sesiones', require('./routes/sesiones'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/contratos', require('./routes/contratos'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Manejador de errores global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Log interno completo, nunca exponer al cliente
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Studio Renacer corriendo en puerto ${PORT}`);
});
