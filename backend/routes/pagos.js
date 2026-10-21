const express = require('express');
const supabase = require('../services/supabaseClient');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { audit } = require('../services/auditLog');
const { verifyStripeSignature, crearCheckoutSession } = require('../services/stripeService');
const { urlPagoPack, packIdDeToken, tokenPagoPack, finDeMes, frontendUrl } = require('../services/enlacePago');

const router = express.Router();

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

    const tipo = ['pack', 'cuota'].includes(md.tipo) ? md.tipo : 'sesion';
    const ahora = new Date().toISOString();

    if (tipo === 'sesion' && md.sesion_id) {
      const { error } = await supabase.from('sesiones')
        .update({ estado_pago: 'pagado', fecha_pago: ahora, updated_at: ahora })
        .eq('id', md.sesion_id);
      if (error) throw new Error('marcar sesión pagada: ' + error.message);
    } else if (tipo === 'pack' && md.pack_id) {
      const { error } = await supabase.from('packs')
        .update({ estado_pago: 'pagado', fecha_pago: ahora, updated_at: ahora })
        .eq('id', md.pack_id);
      if (error) throw new Error('marcar pack pagado: ' + error.message);
      // Si antes había empezado el plan fraccionado y lo abandonó, las cuotas
      // sin pagar sobran: se borran para que el cron no recuerde una 2ª cuota.
      await supabase.from('cuotas_pack').delete().eq('pack_id', md.pack_id).eq('estado_pago', 'no_pagado');
      await supabase.from('packs').update({ num_cuotas: 1 }).eq('id', md.pack_id);
    } else if (tipo === 'cuota' && md.cuota_id) {
      const { error: cuotaErr } = await supabase.from('cuotas_pack')
        .update({ estado_pago: 'pagado', fecha_pago: ahora })
        .eq('id', md.cuota_id);
      if (cuotaErr) throw new Error('marcar cuota pagada: ' + cuotaErr.message);

      // Recalcular el estado del pack: pagado si ya no quedan cuotas pendientes,
      // si no, pago_parcial (valor ya usado por el marcado manual de Andrea).
      const { data: cuotas, error: qErr } = await supabase
        .from('cuotas_pack').select('estado_pago').eq('pack_id', md.pack_id);
      if (qErr) throw new Error('leer cuotas: ' + qErr.message);
      const todasPagadas = (cuotas || []).every((c) => c.estado_pago === 'pagado');
      const { error: packErr } = await supabase.from('packs')
        .update(todasPagadas
          ? { estado_pago: 'pagado', fecha_pago: ahora, updated_at: ahora }
          : { estado_pago: 'pago_parcial', updated_at: ahora })
        .eq('id', md.pack_id);
      if (packErr) throw new Error('actualizar pack de la cuota: ' + packErr.message);
    }

    // Registrar el pago (ledger). stripe_session_id UNIQUE cierra la idempotencia
    // incluso ante una carrera entre dos entregas del mismo evento.
    const { error: insErr } = await supabase.from('pagos').insert({
      stripe_session_id: stripeSessionId,
      paciente_id: md.paciente_id || null,
      tipo,
      pack_id: (tipo === 'pack' || tipo === 'cuota') ? (md.pack_id || null) : null,
      sesion_id: tipo === 'sesion' ? (md.sesion_id || null) : null,
      cuota_id: tipo === 'cuota' ? (md.cuota_id || null) : null,
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

// Reúne importe/concepto/metadata de una sesión suelta o un pack (pago único),
// validando que se puede cobrar. Devuelve { error, status } o { importe, concepto, metadata, email }.
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
      concepto: CONCEPTO.sesion,
      email: s.pacientes?.users?.email,
      metadata: { origen: 'terapia', tipo: 'sesion', sesion_id: s.id, paciente_id: s.paciente_id },
    };
  }

  const { data: pk } = await supabase
    .from('packs')
    .select('id, paciente_id, estado_pago, precio_cents, num_cuotas, pacientes ( users ( email ) )')
    .eq('id', pack_id).single();
  if (!pk) return { status: 404, error: 'Bono no encontrado' };
  if (pacienteId && pk.paciente_id !== pacienteId) return { status: 404, error: 'Bono no encontrado' };
  if (pk.estado_pago === 'pagado') return { status: 400, error: 'El bono ya está pagado' };
  if (!pk.precio_cents) return { status: 400, error: 'El bono no tiene precio' };
  return {
    importe: pk.precio_cents,
    concepto: CONCEPTO.pack,
    email: pk.pacientes?.users?.email,
    metadata: { origen: 'terapia', tipo: 'pack', pack_id: pk.id, paciente_id: pk.paciente_id },
    _pack: pk,
  };
}

// Pago fraccionado de un bono (solo bonos, nunca sesiones sueltas): crea las
// 2 cuotas si es la primera vez ("plan":"fraccionado" elegido por el paciente
// al pagar) y devuelve el cobro de la cuota 1. Si las cuotas ya existían
// (reintento tras abandonar el pago), reutiliza la cuota 1 sin duplicar filas.
// Plazos: 1ª antes de que acabe el mes en curso, 2ª antes de que acabe el
// mes siguiente (recordatorio por email el día 10 de ese mes, ver cron).
async function prepararCobroFraccionado(pack_id, { pacienteId = null } = {}) {
  const prep = await prepararCobro('pack', { pack_id }, { pacienteId });
  if (prep.error) return prep;
  const pk = prep._pack;

  const { data: existentes, error: exErr } = await supabase
    .from('cuotas_pack').select('*').eq('pack_id', pk.id).order('numero');
  if (exErr) return { status: 500, error: exErr.message };

  let cuota1 = existentes?.find((c) => c.numero === 1);
  if (!cuota1) {
    const mitad = Math.round(pk.precio_cents / 2);
    const resto = pk.precio_cents - mitad;
    const { data: nuevas, error: insErr } = await supabase.from('cuotas_pack').insert([
      { pack_id: pk.id, numero: 1, importe_cents: mitad, fecha_limite: finDeMes(0) },
      { pack_id: pk.id, numero: 2, importe_cents: resto, fecha_limite: finDeMes(1) },
    ]).select();
    if (insErr) return { status: 500, error: insErr.message };
    await supabase.from('packs').update({ num_cuotas: 2, updated_at: new Date().toISOString() }).eq('id', pk.id);
    cuota1 = nuevas.find((c) => c.numero === 1);
  } else if (cuota1.estado_pago === 'pagado') {
    return { status: 400, error: 'La cuota 1 ya está pagada' };
  }

  return {
    importe: cuota1.importe_cents,
    concepto: `${CONCEPTO.pack} — cuota 1/2`,
    email: prep.email,
    metadata: { origen: 'terapia', tipo: 'cuota', cuota_id: cuota1.id, pack_id: pk.id, paciente_id: pk.paciente_id },
  };
}

// Cobro de una cuota concreta ya existente (típicamente la 2ª, o para reanudar
// una 1ª abandonada). `pacienteId` (si se pasa) exige que el bono sea suyo.
async function prepararCobroCuota(cuota_id, { pacienteId = null } = {}) {
  const { data: c } = await supabase
    .from('cuotas_pack')
    .select('id, numero, importe_cents, estado_pago, pack_id, packs ( paciente_id, pacientes ( users ( email ) ) )')
    .eq('id', cuota_id).single();
  if (!c) return { status: 404, error: 'Cuota no encontrada' };
  if (pacienteId && c.packs?.paciente_id !== pacienteId) return { status: 404, error: 'Cuota no encontrada' };
  if (c.estado_pago === 'pagado') return { status: 400, error: 'Esta cuota ya está pagada' };
  return {
    importe: c.importe_cents,
    concepto: `${CONCEPTO.pack} — cuota ${c.numero}/2`,
    email: c.packs?.pacientes?.users?.email,
    metadata: { origen: 'terapia', tipo: 'cuota', cuota_id: c.id, pack_id: c.pack_id, paciente_id: c.packs?.paciente_id },
  };
}

async function prepararSegunTipo(tipo, body, opts) {
  if (tipo === 'cuota') return prepararCobroCuota(body.cuota_id, opts);
  if (tipo === 'pack' && body.plan === 'fraccionado') return prepararCobroFraccionado(body.pack_id, opts);
  return prepararCobro(tipo, body, opts);
}

// ── Paciente: iniciar el pago de su sesión suelta, su bono o una cuota ───────
router.post('/checkout', verifyToken, async (req, res) => {
  if (req.user.role !== 'paciente') return res.status(403).json({ error: 'Solo para pacientes' });
  const { tipo } = req.body;
  if (!['sesion', 'pack', 'cuota'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });

  try {
    const { data: paciente, error: pErr } = await supabase
      .from('pacientes').select('id, pago_online_habilitado').eq('user_id', req.user.id).single();
    if (pErr) return res.status(404).json({ error: 'Perfil de paciente no encontrado' });
    if (!paciente.pago_online_habilitado) return res.status(403).json({ error: 'pago_online_no_habilitado' });

    const prep = await prepararSegunTipo(tipo, req.body, { pacienteId: paciente.id });
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const base = frontendUrl();
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: prep.concepto,
      metadata: prep.metadata,
      successUrl: `${base}/paciente?pago=ok`,
      cancelUrl: `${base}/paciente?pago=cancelado`,
      customerEmail: prep.email,
    });

    audit(req, 'create_checkout', 'payments', prep.metadata.sesion_id || prep.metadata.cuota_id || prep.metadata.pack_id, { tipo });
    res.json({ url: sesionStripe.url });
  } catch (err) {
    console.error('[pagos checkout]', err.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago' });
  }
});

// ── Admin: generar un enlace de pago para copiar/enviar ──────────────────────
// Bonos (y sus cuotas): enlace a la página /pagar/<token>, donde el paciente
// elige pago único o en 2 pagos y que no caduca. Sesiones sueltas: enlace
// directo de Stripe Checkout, como siempre.
router.post('/enlace', verifyToken, requireAdmin, async (req, res) => {
  const { tipo } = req.body;
  if (!['sesion', 'pack', 'cuota'].includes(tipo)) return res.status(400).json({ error: 'tipo inválido' });

  try {
    if (tipo === 'pack' || tipo === 'cuota') {
      let packId = req.body.pack_id;
      if (tipo === 'cuota') {
        const { data: c } = await supabase.from('cuotas_pack').select('pack_id').eq('id', req.body.cuota_id).single();
        packId = c?.pack_id;
      }
      const { data: pk } = await supabase.from('packs').select('id, estado_pago').eq('id', packId).single();
      if (!pk) return res.status(404).json({ error: 'Bono no encontrado' });
      if (pk.estado_pago === 'pagado') return res.status(400).json({ error: 'El bono ya está pagado' });
      audit(req, 'create_payment_link', 'payments', pk.id, { tipo: 'pack_eleccion' });
      return res.json({ url: urlPagoPack(pk.id) });
    }

    const prep = await prepararSegunTipo(tipo, req.body, {});
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const base = frontendUrl();
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: prep.concepto,
      metadata: prep.metadata,
      successUrl: `${base}/paciente?pago=ok`,
      cancelUrl: `${base}/paciente?pago=cancelado`,
      customerEmail: prep.email,
    });

    audit(req, 'create_payment_link', 'payments', prep.metadata.sesion_id || prep.metadata.cuota_id || prep.metadata.pack_id, { tipo });
    res.json({ url: sesionStripe.url });
  } catch (err) {
    console.error('[pagos enlace]', err.message);
    res.status(502).json({ error: 'No se pudo generar el enlace de pago' });
  }
});

// ── Público (enlace firmado): página de pago de un bono ──────────────────────
// Sin login: el paciente llega desde el enlace que le envía Andrea o desde el
// recordatorio de la 2ª cuota. Solo devuelve importes, plazos y estado; nunca
// nombre, email ni datos clínicos. 404 genérico ante cualquier token inválido.
async function packDeToken(token) {
  const packId = packIdDeToken(token);
  if (!packId) return null;
  const { data: pk } = await supabase
    .from('packs')
    .select('id, estado_pago, precio_cents, num_sesiones_total, pacientes ( pago_online_habilitado, users ( idioma_preferido ) ), cuotas_pack ( id, numero, importe_cents, fecha_limite, estado_pago )')
    .eq('id', packId).single();
  return pk || null;
}

router.get('/publico/:token', async (req, res) => {
  try {
    const pk = await packDeToken(req.params.token);
    if (!pk) return res.status(404).json({ error: 'Enlace no válido' });
    const cuotas = pk.cuotas_pack || [];
    const cuota2 = cuotas.find((c) => c.numero === 2);
    const mitad = pk.precio_cents ? Math.round(pk.precio_cents / 2) : null;
    res.json({
      estado_pago: pk.estado_pago || 'no_pagado',
      disponible: !!pk.pacientes?.pago_online_habilitado && !!pk.precio_cents,
      idioma: pk.pacientes?.users?.idioma_preferido || 'es',
      num_sesiones: pk.num_sesiones_total,
      precio_cents: pk.precio_cents,
      // Plan fraccionado propuesto (si aún no ha elegido): mitad + resto
      fraccionado: mitad == null ? null : {
        cuota1_cents: mitad, cuota1_limite: cuotas.find((c) => c.numero === 1)?.fecha_limite || finDeMes(0),
        cuota2_cents: pk.precio_cents - mitad, cuota2_limite: cuota2?.fecha_limite || finDeMes(1),
      },
      // 2ª cuota pendiente (si ya pagó la 1ª)
      cuota2_pendiente: pk.estado_pago === 'pago_parcial' && cuota2 && cuota2.estado_pago !== 'pagado'
        ? { importe_cents: cuota2.importe_cents, fecha_limite: cuota2.fecha_limite }
        : null,
    });
  } catch (err) {
    console.error('[pagos publico]', err.message); res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// plan: 'unico' | 'fraccionado' (1ª cuota) | 'cuota2'
router.post('/publico/:token/checkout', async (req, res) => {
  const { plan } = req.body || {};
  if (!['unico', 'fraccionado', 'cuota2'].includes(plan)) return res.status(400).json({ error: 'plan inválido' });

  try {
    const pk = await packDeToken(req.params.token);
    if (!pk) return res.status(404).json({ error: 'Enlace no válido' });
    if (!pk.pacientes?.pago_online_habilitado) return res.status(403).json({ error: 'pago_online_no_habilitado' });

    let prep;
    if (plan === 'cuota2') {
      if (pk.estado_pago !== 'pago_parcial') return res.status(400).json({ error: 'No hay una 2ª cuota pendiente' });
      const cuota2 = (pk.cuotas_pack || []).find((c) => c.numero === 2);
      if (!cuota2) return res.status(400).json({ error: 'No hay una 2ª cuota pendiente' });
      prep = await prepararCobroCuota(cuota2.id);
    } else {
      // Con la 1ª cuota ya pagada no se puede volver a elegir plan.
      if (pk.estado_pago === 'pago_parcial') return res.status(400).json({ error: 'Ya pagaste la 1ª cuota' });
      prep = plan === 'fraccionado'
        ? await prepararCobroFraccionado(pk.id)
        : await prepararCobro('pack', { pack_id: pk.id });
    }
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const vuelta = `${frontendUrl()}/pagar/${tokenPagoPack(pk.id)}`;
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: prep.concepto,
      metadata: prep.metadata,
      successUrl: `${vuelta}?pago=ok`,
      cancelUrl: `${vuelta}?pago=cancelado`,
      customerEmail: prep.email,
    });

    audit(req, 'create_checkout_public', 'payments', pk.id, { plan });
    res.json({ url: sesionStripe.url });
  } catch (err) {
    console.error('[pagos publico checkout]', err.message);
    res.status(502).json({ error: 'No se pudo iniciar el pago' });
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

// Genera el enlace de pago de una sesión suelta para incrustarlo en un email
// (confirmación de cita o resultado de solicitud). Uso "silencioso": ante
// cualquier fallo o si no procede cobrar (ya pagada, sin precio…) devuelve
// null en vez de lanzar, para no romper el envío del email por esto.
async function generarEnlacePagoSesionSuelta(sesionId) {
  try {
    const prep = await prepararCobro('sesion', { sesion_id: sesionId });
    if (prep.error) return null;
    const base = frontendUrl();
    const sesionStripe = await crearCheckoutSession({
      importeCents: prep.importe,
      concepto: prep.concepto,
      metadata: prep.metadata,
      successUrl: `${base}/paciente?pago=ok`,
      cancelUrl: `${base}/paciente?pago=cancelado`,
      customerEmail: prep.email,
    });
    return sesionStripe.url;
  } catch (err) {
    console.error('[pagos] generarEnlacePagoSesionSuelta:', err.message);
    return null;
  }
}

module.exports = router;
module.exports.generarEnlacePagoSesionSuelta = generarEnlacePagoSesionSuelta;
