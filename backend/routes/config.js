const express = require('express');
const { HORA_INICIO, HORA_FIN, DIAS_LABORALES, ANTELACION_MINIMA_HORAS } = require('../config/horario');

const router = express.Router();

// Horario de consulta (datos NO sensibles). Lo consume el frontend para pintar
// el calendario sin duplicar los valores: la fuente de verdad es
// backend/config/horario.js, el mismo que valida solicitudes y disponibilidad.
router.get('/horario', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ HORA_INICIO, HORA_FIN, DIAS_LABORALES, ANTELACION_MINIMA_HORAS });
});

module.exports = router;
