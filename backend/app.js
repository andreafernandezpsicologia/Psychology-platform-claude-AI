const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
