// Calendarios externos (entrantes): Andrea conecta la dirección iCal privada de
// su calendario personal (Google, Outlook, Apple) y sus citas aparecen como
// bloques "Ocupado" en el calendario de la plataforma y en la disponibilidad.
//
// Limitaciones documentadas:
// - Los eventos de día completo NO bloquean (suelen ser cumpleaños/festivos).
// - Los eventos marcados como "libre" (TRANSP:TRANSPARENT) NO bloquean.
// - Eventos recurrentes: se expanden con la RRULE; en los cambios de hora
//   (último domingo de marzo/octubre) puede haber un desfase de ±1h en
//   ocurrencias muy cercanas al cambio. Aceptable para bloques de ocupación.

const ical = require('node-ical');
const supabase = require('./supabaseClient');
const { naiveToMs, aParedMadrid } = require('./fechaPared');

const TTL_MS = 10 * 60 * 1000; // cache 10 min: no pegarle a Google en cada navegación
const cache = new Map(); // url → { ts, data }

async function fetchCalendario(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.data;
  const data = await ical.async.fromURL(url, { timeout: 10000 });
  cache.set(url, { ts: Date.now(), data });
  return data;
}

function textoDe(valor, fallback) {
  if (!valor) return fallback;
  return typeof valor === 'object' ? (valor.val || fallback) : String(valor);
}

// Devuelve bloques { inicio, fin, titulo } en hora de pared Madrid que intersectan
// [desdeNaive, hastaNaive). Nunca lanza: si un calendario falla, se omite (fail-open).
async function bloquesOcupados(desdeNaive, hastaNaive) {
  const desdeMs = naiveToMs(desdeNaive);
  const hastaMs = naiveToMs(hastaNaive);
  // Para expandir RRULEs hace falta un rango de instantes absolutos: el ms
  // ficticio difiere del real en ±2h, así que se ensancha el rango y se filtra
  // después con precisión en espacio de pared.
  const rangoDesde = new Date(desdeMs - 26 * 3600000);
  const rangoHasta = new Date(hastaMs + 26 * 3600000);

  let calendarios = [];
  try {
    const { data } = await supabase.from('calendarios_externos').select('*').eq('activo', true);
    calendarios = data || [];
  } catch (err) {
    console.error('[calendarios-externos] Error leyendo lista:', err.message);
    return [];
  }

  const bloques = [];
  for (const cal of calendarios) {
    try {
      const eventos = await fetchCalendario(cal.url);

      for (const ev of Object.values(eventos)) {
        if (ev.type !== 'VEVENT') continue;
        if (String(ev.transparency || '').toUpperCase() === 'TRANSPARENT') continue;
        if (ev.datetype === 'date') continue; // día completo: no bloquea
        if (!ev.start || !ev.end) continue;

        const durMs = ev.end.getTime() - ev.start.getTime();
        if (durMs <= 0) continue;

        const titulo = textoDe(ev.summary, cal.nombre);
        const inicios = [];

        if (ev.rrule) {
          const exdates = new Set(
            Object.values(ev.exdate || {}).map((d) => new Date(d).getTime())
          );
          for (const f of ev.rrule.between(new Date(rangoDesde.getTime() - durMs), rangoHasta, true)) {
            if (exdates.has(f.getTime())) continue;
            inicios.push(f);
          }
          // Ocurrencias modificadas individualmente (RECURRENCE-ID)
          for (const ov of Object.values(ev.recurrences || {})) {
            if (ov.start && ov.end) {
              bloques.push({
                inicio: aParedMadrid(ov.start),
                fin: aParedMadrid(ov.end),
                titulo: textoDe(ov.summary, titulo),
              });
            }
          }
        } else {
          inicios.push(ev.start);
        }

        for (const ini of inicios) {
          bloques.push({
            inicio: aParedMadrid(ini),
            fin: aParedMadrid(new Date(ini.getTime() + durMs)),
            titulo,
          });
        }
      }

      // fire-and-forget: marca la última sincronización correcta
      supabase.from('calendarios_externos')
        .update({ last_synced_at: new Date().toISOString(), last_error: null })
        .eq('id', cal.id)
        .then(() => {}, () => {});
    } catch (err) {
      console.error(`[calendarios-externos] ${cal.nombre}:`, err.message);
      supabase.from('calendarios_externos')
        .update({ last_error: String(err.message).slice(0, 200) })
        .eq('id', cal.id)
        .then(() => {}, () => {});
    }
  }

  // Filtro preciso en espacio de pared
  return bloques.filter((b) => {
    try {
      return naiveToMs(b.inicio) < hastaMs && naiveToMs(b.fin) > desdeMs;
    } catch {
      return false;
    }
  });
}

module.exports = { bloquesOcupados };
