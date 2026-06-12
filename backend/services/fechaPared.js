// Utilidades de "hora de pared" (Europe/Madrid).
//
// sesiones.fecha_hora se guarda como TIMESTAMP naive con la hora de pared de
// Madrid. Toda la aritmética se hace en UTC "ficticio" (Date.UTC sobre los
// componentes) para no depender de la TZ del servidor (Render corre en UTC).
// Nunca usar new Date(string) ni toISOString() sobre estas fechas.

const FECHA_NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

function naiveToMs(naive) {
  const m = String(naive).match(FECHA_NAIVE_RE);
  if (!m) throw new Error(`fecha_hora inválida: ${naive}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
}

function msToNaive(ms) {
  return new Date(ms).toISOString().slice(0, 19);
}

// Convierte un instante absoluto (Date) a hora de pared de Madrid 'YYYY-MM-DDTHH:mm:ss'
function aParedMadrid(date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(' ', 'T');
}

// Hora de pared de Madrid AHORA, en ms ficticios (comparable con naiveToMs)
function ahoraParedMs() {
  return naiveToMs(aParedMadrid(new Date()));
}

// Día de la semana (0=domingo..6=sábado) de una fecha naive
function diaSemana(naive) {
  return new Date(naiveToMs(naive)).getUTCDay();
}

module.exports = { FECHA_NAIVE_RE, naiveToMs, msToNaive, aParedMadrid, ahoraParedMs, diaSemana };
