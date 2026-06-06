const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://studiorenacer.com',
  'https://www.studiorenacer.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, Postman, server-to-server
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: origen no permitido'));
  },
  credentials: true,
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/sesiones', require('./routes/sesiones'));
app.use('/api/packs', require('./routes/packs'));
app.use('/api/documentos', require('./routes/documentos'));
app.use('/api/contratos', require('./routes/contratos'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Studio Renacer corriendo en puerto ${PORT}`);
});
