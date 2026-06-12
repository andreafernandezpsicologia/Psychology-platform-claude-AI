// Horario de consulta de Andrea. Solo afecta al renderizado (atenuar horas
// fuera de horario en la vista semanal); no es una validación de negocio.
// Si algún día hace falta editarlo desde la app, migrar a una tabla settings.
export const HORA_INICIO = 9;
export const HORA_FIN = 20;
export const DIAS_LABORALES = [1, 2, 3, 4, 5]; // lunes a viernes (getDay: 0=domingo)
