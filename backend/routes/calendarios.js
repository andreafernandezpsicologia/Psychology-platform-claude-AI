const express = require('express');
const crypto = require('crypto');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { buildFeedICS } = require('../services/icsService');
const { bloquesOcupados } = require('../services/externalCalendarService');
const { FECHA_NAIVE_RE, msToNaive, naiveToMs } = require('../services/fechaPared');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function feedUrlDe(token) {
  return `${FRONTEND_URL}/api/calendarios/feed/${token}`;
}

// ── Feed iCal saliente (suscripción desde Google/Apple/Outlook) ───────────────

// Obtener mi URL de feed (se crea el token la primera vez)
router.get('/feed-url', verifyToken, async (req, res) => {
  try {
    const { data: existente } = await supabase
      .from('calendar_feeds')
      .select('token')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (existente) return res.json({ url: feedUrlDe(existente.token) });

    const token = crypto.randomBytes(32).toString('hex');
    const { error } = await supabase
      .from('calendar_feeds')
      .insert({ user_id: req.user.id, token });
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'create_calendar_feed', 'calendar_feeds', req.user.id);
    res.json({ url: feedUrlDe(token) });
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Regenerar el token (invalida la URL anterior)
router.post('/feed-url/regenerar', verifyToken, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const { error } = await supabase
      .from('calendar_feeds')
      .upsert({ user_id: req.user.id, token }, { onConflict: 'user_id' });
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'regenerate_calendar_feed', 'calendar_feeds', req.user.id);
    res.json({ url: feedUrlDe(token) });
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// El feed en sí. Sin JWT: el token largo y aleatorio ES la autenticación
// (las apps de calendario no pueden enviar cookies). Si se filtra la URL,
// regenerar el token desde la app.
router.get('/feed/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).send('Not found');

    const { data: feed } = await supabase
      .from('calendar_feeds')
      .select('user_id, users ( role )')
      .eq('token', token)
      .maybeSingle();

    if (!feed) return res.status(404).send('Not found');

    const esAdmin = feed.users?.role === 'admin';
    // Ventana: 60 días atrás → 365 adelante
    const desde = msToNaive(Date.now() - 60 * 86400000);
    const hasta = msToNaive(Date.now() + 365 * 86400000);

    let query = supabase
      .from('sesiones')
      .select('id, fecha_hora, duracion_minutos, tipo, estado, enlace_videollamada, pacientes ( user_id, users ( nombre_completo ) )')
      .in('estado', ['programada', 'completada', 'solicitada'])
      .gte('fecha_hora', desde)
      .lte('fecha_hora', hasta)
      .order('fecha_hora', { ascending: true })
      .limit(1000);

    // Para un feed de paciente se acota la consulta a SUS sesiones: si se
    // filtrara en JS tras el limit sobre el conjunto global de todos los
    // pacientes, sus citas más lejanas se perderían al superar el límite.
    if (!esAdmin) {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', feed.user_id)
        .maybeSingle();
      if (!pac) {
        res.set('Content-Type', 'text/calendar; charset=utf-8');
        res.set('Cache-Control', 'private, max-age=300');
        return res.send(buildFeedICS([], 'Studio Renacer — Mis citas'));
      }
      query = query.eq('paciente_id', pac.id);
    }

    const { data: sesiones, error } = await query;
    if (error) return res.status(500).send('Error');

    const visibles = (sesiones || []).filter(
      (s) => esAdmin || s.pacientes?.user_id === feed.user_id
    );

    for (const s of visibles) {
      const nombre = s.pacientes?.users?.nombre_completo;
      if (esAdmin) {
        s._summary = `Sesión: ${nombre || '—'}${s.estado === 'solicitada' ? ' (por confirmar)' : ''}`;
      } else {
        s._summary = `Sesión de psicología — Studio Renacer${s.estado === 'solicitada' ? ' (por confirmar)' : ''}`;
      }
      s._status = s.estado === 'solicitada' ? 'TENTATIVE' : 'CONFIRMED';
    }

    supabase.from('calendar_feeds')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('token', token)
      .then(() => {}, () => {});

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Cache-Control', 'private, max-age=300');
    res.send(buildFeedICS(visibles, esAdmin ? 'Studio Renacer — Agenda' : 'Studio Renacer — Mis citas'));
  } catch (err) {
    console.error('[feed]', err.message);
    res.status(500).send('Error');
  }
});

// ── Calendarios externos entrantes (bloques "Ocupado") ───────────────────────

router.get('/externos', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendarios_externos')
      .select('id, nombre, activo, created_at, last_synced_at, last_error')
      .order('created_at', { ascending: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data); // la URL (credencial) no se devuelve nunca al cliente
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/externos', verifyToken, requireAdmin, async (req, res) => {
  const { nombre, url } = req.body;
  if (!nombre || !url) return res.status(400).json({ error: 'nombre y url son obligatorios' });
  let parsed;
  try {
    parsed = new URL(url.trim().replace(/^webcal:\/\//i, 'https://'));
  } catch {
    return res.status(400).json({ error: 'URL no válida' });
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return res.status(400).json({ error: 'La URL debe ser http(s) o webcal' });
  }

  try {
    const { data, error } = await supabase
      .from('calendarios_externos')
      .insert({ nombre: String(nombre).slice(0, 80), url: parsed.href })
      .select('id, nombre, activo, created_at')
      .single();
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'add_external_calendar', 'external_calendars', data.id, { nombre: data.nombre });
    res.status(201).json(data);
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/externos/:id', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('calendarios_externos')
      .delete()
      .eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });

    audit(req, 'delete_external_calendar', 'external_calendars', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Bloques ocupados de los calendarios externos en un rango (para pintar en el calendario)
router.get('/ocupado', verifyToken, requireAdmin, async (req, res) => {
  const { desde, hasta } = req.query;
  if (!FECHA_NAIVE_RE.test(String(desde)) || !FECHA_NAIVE_RE.test(String(hasta))) {
    return res.status(400).json({ error: 'desde y hasta son obligatorios (YYYY-MM-DDTHH:MM:SS)' });
  }
  if (naiveToMs(hasta) - naiveToMs(desde) > 70 * 86400000) {
    return res.status(400).json({ error: 'Rango máximo: 70 días' });
  }
  try {
    res.json(await bloquesOcupados(desde, hasta));
  } catch (err) {
    console.error('[calendarios]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
