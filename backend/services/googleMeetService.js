// Generación automática de enlaces de Google Meet.
//
// Andrea conecta su cuenta de Google una sola vez (OAuth, scope calendar.events)
// y la plataforma crea un evento en su Google Calendar por cada sesión de
// videollamada: Google devuelve un enlace de Meet nuevo para cada una.
//
// Minimización de datos (RGPD art. 5.1.c): el evento NO lleva nombre, email ni
// ningún dato del paciente — solo un título neutro, fecha y hora. A Google no
// le llega nada del área clínica. Como Meet exige que Andrea (anfitriona)
// admita a quien llama, nadie entra a la sesión sin su visto bueno.
//
// El evento se marca TRANSPARENT ("libre"): así el lector de calendarios
// externos (externalCalendarService) no lo re-importa como bloque "Ocupado"
// encima de la propia sesión que lo originó.
//
// Si Google no responde o la cuenta no está conectada, todo degrada al flujo
// manual (pegar el enlace a mano): ninguna operación de agenda falla por Meet.

const crypto = require('crypto');
const supabase = require('./supabaseClient');
const { naiveToMs, msToNaive } = require('./fechaPared');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Hay credenciales OAuth de la app (Google Cloud) en el entorno
function configurado() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

// Andrea ya conectó su cuenta (hay refresh token guardado)
async function cuentaConectada() {
  if (!configurado()) return null;
  const { data } = await supabase
    .from('google_oauth')
    .select('email, updated_at')
    .eq('id', 1)
    .maybeSingle();
  return data || null;
}

async function guardarRefreshToken(refreshToken, email) {
  const { error } = await supabase
    .from('google_oauth')
    .upsert({ id: 1, refresh_token: refreshToken, email: email || null, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  tokenCache = { accessToken: null, expiraMs: 0 };
}

async function desconectar() {
  const { data } = await supabase.from('google_oauth').select('refresh_token').eq('id', 1).maybeSingle();
  if (data?.refresh_token) {
    // Revocar en Google (best-effort): deja de valer aunque quedara copiado en algún sitio
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: 'POST' });
    } catch (err) {
      console.warn('[googleMeet] revoke:', err.message);
    }
  }
  await supabase.from('google_oauth').delete().eq('id', 1);
  tokenCache = { accessToken: null, expiraMs: 0 };
}

// ── Access token (se renueva con el refresh token, cache en memoria) ─────────

let tokenCache = { accessToken: null, expiraMs: 0 };

async function getAccessToken() {
  if (!configurado()) return null;
  if (tokenCache.accessToken && Date.now() < tokenCache.expiraMs - 60000) {
    return tokenCache.accessToken;
  }

  const { data } = await supabase.from('google_oauth').select('refresh_token').eq('id', 1).maybeSingle();
  if (!data?.refresh_token) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // invalid_grant = Andrea revocó el acceso desde su cuenta de Google
    throw new Error(`token refresh ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  tokenCache = {
    accessToken: json.access_token,
    expiraMs: Date.now() + (json.expires_in || 3600) * 1000,
  };
  return tokenCache.accessToken;
}

// ── Eventos con Meet en el calendario primario de Andrea ─────────────────────

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

function cuerpoEvento(fechaHora, duracionMinutos) {
  // fecha_hora es hora de pared de Madrid sin zona: se manda tal cual con
  // timeZone explícita (formato que Calendar API acepta y resuelve el DST).
  const iniNaive = msToNaive(naiveToMs(fechaHora)); // normaliza a YYYY-MM-DDTHH:MM:SS
  const finNaive = msToNaive(naiveToMs(fechaHora) + (duracionMinutos || 50) * 60000);
  return {
    start: { dateTime: iniNaive, timeZone: 'Europe/Madrid' },
    end: { dateTime: finNaive, timeZone: 'Europe/Madrid' },
  };
}

// Crea el evento y devuelve { enlace, eventId } o null si no hay cuenta conectada.
async function crearEventoMeet(fechaHora, duracionMinutos) {
  const token = await getAccessToken();
  if (!token) return null;

  const res = await fetch(`${CAL_BASE}?conferenceDataVersion=1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: 'Videollamada — Studio Renacer',
      description: 'Sesión gestionada desde la plataforma. Los detalles están en Studio Renacer.',
      ...cuerpoEvento(fechaHora, duracionMinutos),
      transparency: 'transparent',
      reminders: { useDefault: false },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`crear evento ${res.status}: ${body.slice(0, 200)}`);
  }

  const ev = await res.json();
  const enlace = ev.hangoutLink
    || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
    || null;
  if (!enlace) throw new Error('Google no devolvió enlace de Meet');
  return { enlace, eventId: ev.id };
}

// Mueve el evento a la nueva fecha (al reagendar). Best-effort.
async function moverEventoMeet(eventId, fechaHora, duracionMinutos) {
  const token = await getAccessToken();
  if (!token || !eventId) return;
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoEvento(fechaHora, duracionMinutos)),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`mover evento ${res.status}`);
  }
}

// Borra el evento (al cancelar la sesión). Best-effort; 404/410 = ya no existe.
async function borrarEventoMeet(eventId) {
  const token = await getAccessToken();
  if (!token || !eventId) return;
  const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`borrar evento ${res.status}`);
  }
}

module.exports = {
  configurado,
  cuentaConectada,
  guardarRefreshToken,
  desconectar,
  crearEventoMeet,
  moverEventoMeet,
  borrarEventoMeet,
  CLIENT_ID,
  CLIENT_SECRET,
};
