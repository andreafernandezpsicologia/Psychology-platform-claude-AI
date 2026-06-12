// Genera archivos iCalendar (.ics) para las citas.
//
// fecha_hora llega como hora de pared de Madrid SIN zona horaria (igual que en BD).
// DTSTART;TZID=Europe/Madrid acepta esa hora de pared directamente, por lo que no
// se hace ninguna conversión de zona ni de DST: solo se reformatea el string.
// El bloque VTIMEZONE incluye las reglas CET/CEST (estables desde 1996) para que
// Google/Apple/Outlook interpreten la hora correctamente desde cualquier zona.

const VTIMEZONE_MADRID = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Madrid',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');

// Caracteres especiales de texto iCalendar (RFC 5545 §3.3.11)
function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildSessionICS({ id, fecha_hora, duracion_minutos, tipo }) {
  const m = String(fecha_hora).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new Error(`fecha_hora inválida: ${fecha_hora}`);

  // Aritmética en UTC "ficticio" sobre los componentes: independiente de la TZ del servidor
  const inicioMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const finMs = inicioMs + (duracion_minutos || 50) * 60000;
  const fmtLocal = (ms) => new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, '');
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const location = tipo === 'videollamada' ? 'Videollamada' : 'Studio Renacer (presencial)';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Renacer//Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    VTIMEZONE_MADRID,
    'BEGIN:VEVENT',
    `UID:${id}@studiorenacer.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Madrid:${fmtLocal(inicioMs)}`,
    `DTEND;TZID=Europe/Madrid:${fmtLocal(finMs)}`,
    `SUMMARY:${escapeText('Sesión de psicología — Studio Renacer')}`,
    `LOCATION:${escapeText(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

module.exports = { buildSessionICS };
