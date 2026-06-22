// FALLBACK del horario de consulta para el renderizado del calendario (atenuar
// horas fuera de horario en la vista semanal). La FUENTE DE VERDAD es el backend,
// que lo sirve en GET /api/config/horario (config/horario.js); estos valores solo
// se usan si esa llamada falla. No es validación de negocio.
export const HORA_INICIO = 9;
export const HORA_FIN = 20;
export const DIAS_LABORALES = [1, 2, 3, 4, 5]; // lunes a viernes (getDay: 0=domingo)
