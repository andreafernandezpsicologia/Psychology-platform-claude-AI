const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { verifyStripeSignature, crearCheckoutSession } = require('../services/stripeService');

const router = express.Router();

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://app.studiorenacer.com';
}

// Concepto genérico en la línea de pago: nunca motivo de consulta ni datos
// clínicos (Stripe es un encargado de tratamiento, minimización RGPD).
const CONCEPTO = {
  sesion: 'Sesión de psicología — Studio Renacer',
  pack: 'Bono de sesiones — Studio Renacer',
};

// ── Webhook de Stripe (terapia) ──────────────────────────────────────────────
// Sin auth (Stripe no envía JWT). Verifica la firma con STRIPE_WEBHOOK_SECRET
// (el del endpoint de Render, distinto del de Vercel/aula). Idempotente por
// stripe_session_id. Solo actúa sobre eventos con metadata.origen === 'terapia'
// (los del aula los procesa el webhook de Vercel).
router.post('/stripe/webhook', async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[pagos] STRIPE_WEBHOOK_SECRET no configurada');
    return res.status(500).json({ error: 'Servicio no configurado' });
  }

  const payload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
  if (!verifyStripeSignature(payload, req.headers['stripe-signature'], secret)) {
    console.warn('[pagos] firma Stripe inválida');
    return res.status(400).json({ error: 'Firma inválida' });
  }

  let event;
  try { event = JSON.parse(payload); } catch { return res.status(400).json({ error: 'JSON inválido' }); }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object || {};
  const md = session.metadata || {};
  if (md.origen !== 'terapia') {
    return res.status(200).json({ received: true, ignored: 'no_terapia' });
  }

  try {
    const stripeSessionId = session.id;

    // Idempotencia: si ya registramos este pago, no repetir nada.
    const { data: existente } = await supabase
      .from('pagos').select('id').eq('stripe_session_id', stripeSessionId).limit(1);
    if (existente && existente.length) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const tipo = md.tipo === 'pack' ? 'pack' : 'sesion';
    const ahora = new Date().toISOString();

    // Marcar pagado el pack o la sesión suelta.
    let upErr = null;
    if (tipo === 'pack' && md.pack_id) {
      ({ error: upErr } = await supabase.from('packs')
        .update({ estado_pago: 'pagado', fecha_pago: ahora, updated_at: ahora })
        .eq('id', md.pack_id));
    } else if (tipo === 'sesion' && md.sesion_id) {
      ({ error: upErr } = await supabase.from('sesiones')
        .update({ estado_pago: 'pagado', fecha_pago: ahora, updated_at: ahora })
        .eq('id', md.sesion_id));
    }
    if (upErr) throw new Error('marcar pagado: ' + upErr.message);

    // Registrar el pago (ledger). stripe_session_id UNIQUE cierra la idempotencia
    // incluso ante una carrera entre dos entregas del mismo evento.
    const { error: insErr } = await supabase.from('pagos').insert({
      stripe_session_id: stripeSessionId,
      paciente_id: md.paciente_id || null,
      tipo,
      pack_id: tipo === 'pack' ? (md.pack_id || null) : null,
      sesion_id: tipo === 'sesion' ? (md.sesion_id || null) : null,
      importe_cents: session.amount_total ?? null,
      moneda: session.currency || 'eur',
      metodo_pago: (session.payment_method_types && session.payment_method_types[0]) || null,
      origen: 'stripe',
    });
    if (insErr) throw new Error('registrar pago: ' + insErr.message);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[pagos webhook]', err.message);
    // 500 → Stripe reintenta; la guarda de idempotencia evita doble efecto.
    return res.status(500).json({ error: 'Error procesando el pago' });
  }
});

// ── Tarifas activas (para pintar importes) ──────────────────────────────────
router.get('/tarifas', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tarifas')
      .select('codigo, concepto, precio_cents, num_sesiones')
      .eq('activa', true)
      .order('num_sesiones', { ascending: true, nullsFirst: true });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('[pagos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reúne importe/concepto/metadata de una sesión suelta o un pack, validando que
// se puede cobrar. Devuelve { error, status } o { importe, metadata, email }.
async function prepararCobro(tipo, { sesion_id, pack_id }, { pacienteId = null } = {}) {
  if (tipo === 'sesion') {
    const { data: s } = await supabase
      .from('sesiones')
      .select('id, paciente_id, pack_id, estado_pago, precio_cents, pacientes ( users ( email ) )')
      .eq('id', sesion_id).single();
    if (!s) return { status: 404, error: 'Sesión no encontrada' };
    if (pacienteId && s.paciente_id !== pacienteId) return { status: 404, error: 'Sesión no encontrada' };
    if (s.pack_id) return { status: 400, error: 'La sesión va con un bono' };
    if (s.estado_pago === 'pagado') return { status: 400, error: 'La sesión ya está pagada' };
    if (!s.precio_cents) return { status: 400, error: 'La sesión no tiene precio' };
    return {
      importe: s.precio_cents,
      email: s.pacientes?.users?.email,
      metadata: { origen: 'terapia', tipo: 'sesion', sesion_id: s.id, paciente_id: s.paciente_id },
    };
  }
  const { data: pk } = await supabase
    .from('packs')
    .select('id, paciente_id, estado_pago, precio_cents, pacientes ( users ( email ) )')
    .eq('id', pack_id).single();
  if (!pk) return { status: 404, error: 'Bono no encontrado' };
  if (pacienteId && pk.paciente_id !== pacienteId) return { status: 404, error: 'Bono no encontrado' };
  if (pk.estado_pago === 'pagado') return { status: 400, error: 'El bono ya está pagado' };
  if (!pk.precio_cents) return { status: 400, error: 'El bono no tiene precio' };
  return {
    importe: pk.precio_cents,
    email: pk.pacientes?.users?.email,
    metadata: { origen: 'terapia', tipo: 'pack', pack_id: pk.id, paciente_id: pk.paciente_id },
  };
}

// ── Paciente: iniciar el pago de su sesión suelta o su bono ──────────────────
router.post('/checkout', verifyToken, async (req, res) => {
  if (req.user.role !== 'paciente') return res.status(403).json({ error: 'Solo para pacientes' });
  const { tipo, sesion_id, pack_id } = req.body;
  if (!['sesion', 'pack'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });

  try {
    const { data: paciente, error: pErr } = await supabase
      .from('pacientes').select('id, pago_online_habilitado').eq('user_id', req.user.id).single();
    if (pErr) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });
    if (!paciente.pago_online_habilitado) return res.status(403).json({ error: 'pago_online_no_habilitado' });

    const prep = await prepararCobro(tipo, { sesion_id, pack_id }, { pacienteId: paciente.id });
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const base = frontendUrl();
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: CONCEPTO[tipo],
      metadata: prep.metadata,
      successUrl: `${base}/paciente?pago=ok`,
      cancelUrl: `${base}/paciente?pago=cancelado`,
      customerEmail: prep.email,
    });

    audit(req, 'create_checkout', 'payments', prep.metadata.sesion_id || prep.metadata.pack_id, { tipo });
    res.json({ url: sesionStripe.url });
  } catch (err) {
    console.error('[pagos checkout]', err.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago' });
  }
});

// ── Admin: generar un enlace de pago para copiar/enviar ──────────────────────
router.post('/enlace', verifyToken, requireAdmin, async (req, res) => {
  const { tipo, sesion_id, pack_id } = req.body;
  if (!['sesion', 'pack'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });

  try {
    const prep = await prepararCobro(tipo, { sesion_id, pack_id });
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const base = frontendUrl();
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: CONCEPTO[tipo],
      metadata: prep.metadata,
      successUrl: `${base}/paciente?pago=ok`,
      cancelUrl: `${base}/paciente?pago=cancelado`,
      customerEmail: prep.email,
    });

    audit(req, 'create_payment_link', 'payments', prep.metadata.sesion_id || prep.metadata.pack_id, { tipo });
    res.json({ url: sesionStripe.url });
  } catch (err) {
    console.error('[pagos enlace]', err.message);
    res.status(502).json({ error: 'No se pudo generar el enlace de pago' });
  }
});

// ── Admin: historial de pagos de un paciente ─────────────────────────────────
router.get('/paciente/:pacienteId', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos').select('*')
      .eq('paciente_id', req.params.pacienteId)
      .order('creado_en', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    console.error('[pagos]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
