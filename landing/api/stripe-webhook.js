// /api/stripe-webhook.js
// Recibe eventos de Stripe (checkout.session.completed) y:
//   1) Registra la compra en Supabase (formaciones_compras) — idempotente.
//   2) Crea o amplía el acceso al aula (formaciones_accesos).
//   3) Envía el magic link de acceso por email (Resend).
//
// Configuración en Stripe (dashboard → Developers → Webhooks):
//   - Endpoint: https://www.studiorenacer.com/api/stripe-webhook
//   - Evento:   checkout.session.completed
//   - Copiar el "Signing secret" (whsec_...) a la var STRIPE_WEBHOOK_SECRET en Vercel.
//
// El producto se identifica con metadata.programa = 'calma' | 'sos' | 'vinculos' | 'raices'
// en la Checkout Session / Payment Link. Para el desistimiento UE, activar en el
// Payment Link "Require customers to accept your terms of service" con el texto de
// renuncia al desistimiento en los términos (queda en session.consent.terms_of_service).

import crypto from 'node:crypto';
import { PROGRAMAS, sbInsert, otorgarAcceso, enviarMagicLink, resendSend, escapeHtml } from './_aula.js';

// Necesitamos el cuerpo crudo para verificar la firma de Stripe.
export const config = { api: { bodyParser: false } };

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Verificación manual de la firma (sin dependencia del SDK de Stripe).
function verifyStripeSignature(payload, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(kv => kv.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET no configurada');
    return res.status(500).json({ error: 'Servicio no configurado' });
  }

  const payload = (await rawBody(req)).toString('utf8');
  if (!verifyStripeSignature(payload, req.headers['stripe-signature'], secret)) {
    console.warn('[stripe-webhook] firma inválida');
    return res.status(400).json({ error: 'Firma inválida' });
  }

  let event;
  try { event = JSON.parse(payload); } catch { return res.status(400).json({ error: 'JSON inválido' }); }

  // Solo nos interesa el pago completado del checkout.
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  try {
    const session = event.data.object;
    const email = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();
    const nombre = (session.customer_details?.name || '').trim().split(' ')[0] || null;
    const producto = (session.metadata?.programa || '').trim().toLowerCase();
    const consintio = session.consent?.terms_of_service === 'accepted';

    if (!email) {
      console.error('[stripe-webhook] sesión sin email:', session.id);
      return res.status(200).json({ received: true, warning: 'sin email' });
    }
    if (!PROGRAMAS[producto]) {
      console.error(`[stripe-webhook] metadata.programa desconocido ("${producto}") en sesión ${session.id}`);
      // Avisamos a Andrea para resolverlo a mano, pero respondemos 200 (Stripe no debe reintentar).
      await avisarAndrea(`⚠️ Compra recibida sin programa identificable`, `Sesión de Stripe <b>${escapeHtml(session.id)}</b> de <b>${escapeHtml(email)}</b>: metadata.programa = "${escapeHtml(producto)}". Hay que otorgar el acceso a mano.`);
      return res.status(200).json({ received: true, warning: 'programa desconocido' });
    }

    // 1) Registrar compra (idempotente por stripe_session_id).
    const insertadas = await sbInsert('formaciones_compras', {
      email,
      producto,
      stripe_session_id: session.id,
      stripe_payment_intent: session.payment_intent || null,
      importe_centimos: session.amount_total ?? null,
      moneda: session.currency || 'eur',
      consentimiento_desistimiento: consintio
    }, { onConflict: 'stripe_session_id' });

    // Si la compra ya estaba registrada (reintento de Stripe), no reenviamos el email.
    if (insertadas.length === 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    // 2) Otorgar acceso y 3) enviar magic link.
    const acceso = await otorgarAcceso(email, producto, nombre);
    await enviarMagicLink(acceso, { esCompra: true });

    // Aviso a Andrea de la venta.
    await avisarAndrea(`💛 Nueva compra: ${PROGRAMAS[producto].nombre}`,
      `<b>${escapeHtml(nombre || '—')}</b> (${escapeHtml(email)}) ha comprado <b>${escapeHtml(PROGRAMAS[producto].nombre)}</b> por ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency || 'eur').toUpperCase()}. Acceso enviado automáticamente.${consintio ? '' : ' ⚠️ Sin consentimiento de desistimiento registrado.'}`);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] error:', err);
    // 500 → Stripe reintentará (la inserción es idempotente, sin riesgo de duplicar).
    return res.status(500).json({ error: 'Error interno' });
  }
}

async function avisarAndrea(subject, html) {
  try {
    await resendSend({
      from: process.env.FROM_EMAIL || 'Studio Renacer <admin@studiorenacer.com>',
      to: [process.env.NOTIFY_TO || 'info@studiorenacer.com'],
      subject,
      html: `<div style="font-family:sans-serif;font-size:14px;color:#333">${html}</div>`
    });
  } catch (err) {
    console.error('[stripe-webhook] aviso a Andrea falló:', err.message);
  }
}
