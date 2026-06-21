// Hora de pared de Madrid en el frontend (espejo de backend/services/fechaPared.js).
//
// Las fechas de sesión (fecha_hora) y los bloques "Ocupado" llegan como hora de
// pared de Madrid SIN zona horaria (p. ej. "2026-06-20T10:00:00"). Si se pasan a
// new Date(string), el navegador las interpreta en SU zona, desplazando la hora y
// el día para quien no esté en CET/CEST. parseWall las reconstruye por componentes
// para que siempre muestren la hora de pared correcta en cualquier navegador.

const RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

// Convierte una fecha de pared naive en un Date de componentes locales: los
// getters y date-fns/format locales devuelven la misma hora de pared en cualquier zona.
export function parseWall(naive) {
  const m = String(naive).match(RE);
  if (!m) return new Date(naive); // formato inesperado: degradar a parseo nativo
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

// "Ahora" en hora de pared de Madrid, como Date comparable con parseWall().
export function ahoraParedDate() {
  const partes = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
  return parseWall(partes.replace(' ', 'T'));
}
