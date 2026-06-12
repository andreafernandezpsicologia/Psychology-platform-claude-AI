// Horario de consulta de Andrea (hora de pared, Europe/Madrid).
// Se usa para validar solicitudes de cita y calcular disponibilidad.
// ⚠️ Mantener en sync con frontend/src/utils/calendarConfig.js
const HORA_INICIO = 9;
const HORA_FIN = 20;
const DIAS_LABORALES = [1, 2, 3, 4, 5]; // lunes a viernes (0=domingo)
const ANTELACION_MINIMA_HORAS = 24; // los pacientes solo pueden pedir cita con 24h+

module.exports = { HORA_INICIO, HORA_FIN, DIAS_LABORALES, ANTELACION_MINIMA_HORAS };
