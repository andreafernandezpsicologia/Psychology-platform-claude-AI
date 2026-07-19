// Integración con Stripe para los pagos de TERAPIA (sesiones sueltas y bonos).
// Sin SDK: se habla con la API REST vía fetch, igual que el webhook del aula
// (landing/api/stripe-webhook.js). Misma cuenta de Stripe, endpoint de webhook
// distinto (este vive en el backend de Render, no en Vercel).
const crypto = require('node:crypto');

// Verificación manual de la firma del webhook (idéntica a la del aula).
function verifyStripeSignature(payload, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(String(sigHeader).split(',').map((kv) => kv.split('=')));
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

// Aplana un objeto anidado a pares clave/valor con la notación de Stripe
// (foo[bar][0]=...), para enviarlo como application/x-www-form-urlencoded.
function encodeForm(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === 'object') encodeForm(item, `${key}[${i}]`, out);
        else out.push([`${key}[${i}]`, String(item)]);
      });
    } else if (v && typeof v === 'object') {
      encodeForm(v, key, out);
    } else {
      out.push([key, String(v)]);
    }
  }
  return out;
}

// Crea una Checkout Session de pago único (tarjeta + Bizum, EUR) y devuelve el
// objeto de Stripe (incluye { id, url }). El importe es el precio exacto del
// pack/sesión (soporta precios especiales por paciente). La metadata lleva
// UUIDs opacos + origen:'terapia'; nunca datos clínicos.
async function crearCheckoutSession({ importeCents, concepto, metadata, successUrl, cancelUrl, customerEmail }) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('STRIPE_SECRET_KEY no configurada');
  if (!Number.isInteger(importeCents) || importeCents <= 0) throw new Error('importe inválido');

  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    locale: 'es',
    payment_method_types: ['card', 'bizum'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'eur',
        unit_amount: importeCents,
        product_data: { name: concepto },
      },
    }],
    metadata,
  };
  if (customerEmail) params.customer_email = customerEmail;

  const body = new URLSearchParams(encodeForm(params)).toString();
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || 'Error de Stripe');
  return data;
}

module.exports = { verifyStripeSignature, crearCheckoutSession };
