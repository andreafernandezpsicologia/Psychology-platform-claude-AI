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

// Caracteres especiales de texto iCalendar (RFC 5545 §3.3.11). Los saltos de
// línea (CR, LF o CRLF) se normalizan a la secuencia escapada \n.
function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Plegado de líneas de contenido a 75 octetos (RFC 5545 §3.1). Cuenta OCTETS en
// UTF-8 (no caracteres) y nunca parte un carácter multibyte (acentos, ñ, …).
// Cada línea de continuación empieza con un espacio, que cuenta en el límite.
function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const bytes = Buffer.from(line, 'utf8');
  const segmentos = [];
  let start = 0;
  let limite = 75; // la primera línea va sin espacio inicial
  while (start < bytes.length) {
    let end = Math.min(start + limite, bytes.length);
    // No cortar a mitad de un carácter: retroceder sobre bytes de continuación (10xxxxxx)
    if (end < bytes.length) {
      while (end > start && (bytes[end] & 0xc0) === 0x80) end--;
    }
    segmentos.push(bytes.slice(start, end).toString('utf8'));
    start = end;
    limite = 74; // las continuaciones llevan un espacio delante
  }
  return segmentos.join('\r\n ');
}

function buildVEvent({ id, fecha_hora, duracion_minutos, tipo }, { summary, status = 'CONFIRMED' } = {}) {
  const m = String(fecha_hora).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new Error(`fecha_hora inválida: ${fecha_hora}`);

  // Aritmética en UTC "ficticio" sobre los componentes: independiente de la TZ del servidor
  const inicioMs = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const finMs = inicioMs + (duracion_minutos || 50) * 60000;
  const fmtLocal = (ms) => new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, '');
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const location = tipo === 'videollamada' ? 'Videollamada' : 'Studio Renacer (presencial)';

  return [
    'BEGIN:VEVENT',
    `UID:${id}@studiorenacer.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=Europe/Madrid:${fmtLocal(inicioMs)}`,
    `DTEND;TZID=Europe/Madrid:${fmtLocal(finMs)}`,
    `SUMMARY:${escapeText(summary || 'Sesión de psicología — Studio Renacer')}`,
    `LOCATION:${escapeText(location)}`,
    `STATUS:${status}`,
    'END:VEVENT',
  ].map(foldLine).join('\r\n');
}

function buildCalendar(vevents, nombre = 'Studio Renacer') {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Studio Renacer//Citas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(nombre)}`),
    'X-PUBLISHED-TTL:PT1H',
    VTIMEZONE_MADRID,
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

// .ics de una sola cita (adjuntos de email, botón "Añadir a mi calendario")
function buildSessionICS(sesion) {
  return buildCalendar([buildVEvent(sesion)]);
}

// Feed de suscripción con varias citas. Cada sesión puede llevar
// `_summary` y `_status` ya resueltos por el llamador.
function buildFeedICS(sesiones, nombre) {
  const vevents = sesiones.map((s) => buildVEvent(s, { summary: s._summary, status: s._status }));
  return buildCalendar(vevents, nombre);
}

module.exports = { buildSessionICS, buildFeedICS };
