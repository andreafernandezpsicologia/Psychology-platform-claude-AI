const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// ── Trust proxy: necesario para obtener la IP real del cliente detrás de Vercel/Render ──
app.set('trust proxy', 1);

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
    // Sin Origin = petición servidor-a-servidor, health check, monitoreo — permitir siempre
    // CORS es un mecanismo del navegador; bloquearlo aquí no añade seguridad real
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => o === origin)) return cb(null, true);
    const err = new Error('CORS: origen no permitido');
    err.status = 403;
    cb(err);
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ── Rate limiting global ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,                  // suficiente para un usuario normal, protege contra bots
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo más tarde.' },
  skip: (req) => req.path === '/health', // no limitar health checks
});
app.use('/api', globalLimiter);

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/auth/2fa', require('./routes/twofa'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/sesiones', require('./routes/sesiones'));
app.use('/api/calendarios', require('./routes/calendarios'));
app.use('/api/config', require('./routes/config'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/contratos', require('./routes/contratos'));
app.use('/api/cron', require('./routes/cron'));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Manejador de errores global ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.path}:`, err.message);
  if (status === 403) return res.status(403).json({ error: 'Origen no permitido' });
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Studio Renacer corriendo en puerto ${PORT}`);
});
