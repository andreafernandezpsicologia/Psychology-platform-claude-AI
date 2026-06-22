// Horario de consulta de Andrea (hora de pared, Europe/Madrid).
// FUENTE DE VERDAD: valida solicitudes de cita, calcula disponibilidad y se
// expone al frontend en GET /api/config/horario (ver routes/config.js), que lo
// usa para pintar el calendario. El frontend solo guarda una copia de fallback
// en calendarConfig.js por si la API no responde. Editar aquí basta.
const HORA_INICIO = 9;
const HORA_FIN = 20;
const DIAS_LABORALES = [1, 2, 3, 4, 5]; // lunes a viernes (0=domingo)
const ANTELACION_MINIMA_HORAS = 24; // los pacientes solo pueden pedir cita con 24h+

module.exports = { HORA_INICIO, HORA_FIN, DIAS_LABORALES, ANTELACION_MINIMA_HORAS };
