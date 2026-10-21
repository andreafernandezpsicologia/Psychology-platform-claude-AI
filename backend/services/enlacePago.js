// Enlace de pago "duradero" de un bono: /pagar/<packId>.<firma>. Lleva al
// paciente a una página pública donde elige pago único o en 2 cuotas (y, más
// adelante, paga la 2ª cuota). A diferencia de un enlace de Stripe Checkout
// (caduca a las 24 h), este no caduca: la sesión de Stripe se crea al pulsar.
//
// La firma HMAC (con JWT_SECRET) impide adivinar enlaces de otros bonos sin
// necesitar una columna de token en la BD. El enlace no lleva el ID del
// paciente ni datos personales, solo el UUID opaco del bono.
const crypto = require('node:crypto');
const { aParedMadrid } = require('./fechaPared');

function frontendUrl() {
  return process.env.FRONTEND_URL || 'https://app.studiorenacer.com';
}

function firma(packId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no configurada');
  return crypto.createHmac('sha256', secret).update(`pago-pack:${packId}`).digest('base64url').slice(0, 32);
}

function tokenPagoPack(packId) {
  return `${packId}.${firma(packId)}`;
}

// Devuelve el packId si la firma es válida; null si no.
function packIdDeToken(token) {
  const [packId, sig] = String(token || '').split('.');
  if (!packId || !sig || !/^[0-9a-f-]{36}$/i.test(packId)) return null;
  const esperada = Buffer.from(firma(packId));
  const recibida = Buffer.from(sig);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  return packId;
}

function urlPagoPack(packId) {
  return `${frontendUrl()}/pagar/${tokenPagoPack(packId)}`;
}

// Último día del mes actual (+mesesAdelante) en Madrid, 'YYYY-MM-DD'.
// finDeMes(0) el 21-oct → 2026-10-31; finDeMes(1) → 2026-11-30.
function finDeMes(mesesAdelante = 0, desde = new Date()) {
  const [y, m] = aParedMadrid(desde).slice(0, 7).split('-').map(Number);
  // m es 1-based: día 0 del mes (m + n) en base 0 = último día del mes m + n
  return new Date(Date.UTC(y, m + mesesAdelante, 0)).toISOString().slice(0, 10);
}

module.exports = { tokenPagoPack, packIdDeToken, urlPagoPack, finDeMes, frontendUrl };
