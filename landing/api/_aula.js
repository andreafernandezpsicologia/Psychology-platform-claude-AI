// /api/_aula.js
// Helpers compartidos del Aula de "Renacer en casa".
// (El prefijo "_" hace que Vercel NO exponga este archivo como endpoint.)
//
// Variables de entorno requeridas (Vercel → Project Settings → Environment Variables):
//   SUPABASE_URL                  → https://<ref>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     → clave secreta (formato sb_secret_..., va en cabecera "apikey")
//   RESEND_API_KEY                → ya existente (la usa /api/subscribe)
//   FROM_EMAIL                    → ya existente
//   STRIPE_WEBHOOK_SECRET         → whsec_... (solo la usa /api/stripe-webhook)

import crypto from 'node:crypto';

export const AULA_URL = 'https://www.studiorenacer.com/renacer-en-casa/aula';

export const PROGRAMAS = {
  calma:    { nombre: 'CALMA — Entiende y calma tu ansiedad' },
  sos:      { nombre: 'SOS Ansiedad — Cuando la ansiedad se dispara' },
  vinculos: { nombre: 'VÍNCULOS — Comunicación, límites y relaciones sanas' },
  raices:   { nombre: 'RAÍCES — Entiende tus heridas' }
};

// Qué producto da derecho a qué archivos del bucket privado "formaciones".
// El comprador de CALMA tiene acceso a todo lo de calma/; el de SOS solo al kit.
export const ARCHIVOS = {
  'calma/CALMA-Modulo-0-Bienvenida.pdf':                      ['calma'],
  'calma/CALMA-Modulo-1-Comprende-tu-ansiedad.pdf':           ['calma'],
  'calma/CALMA-Modulo-2-Aquieta-tu-cuerpo.pdf':               ['calma'],
  'calma/CALMA-Modulo-3-Libera-tu-mente.pdf':                 ['calma'],
  'calma/CALMA-Modulo-4-Muevete-hacia-lo-que-evitas.pdf':     ['calma'],
  'calma/CALMA-Modulo-5-Afianza-tu-calma.pdf':                ['calma'],
  'calma/CALMA-Modulo-SOS-Cuando-la-ansiedad-se-dispara.pdf': ['calma', 'sos'],
  'calma/CALMA-Cuaderno-de-ejercicios.pdf':                   ['calma'],
  'calma/CALMA-Diario-de-ansiedad-30-dias.pdf':               ['calma'],
  'calma/CALMA-Tarjeta-Kit-SOS.pdf':                          ['calma', 'sos']
};

export function applyCors(req, res) {
  const allowed = ['https://www.studiorenacer.com', 'https://studiorenacer.com'];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ---------- Supabase (PostgREST + Storage, con clave sb_secret_ en "apikey") ----------

function sbHeaders(extra = {}) {
  return {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
    ...extra
  };
}

export async function sbSelect(table, query) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase select ${table} ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function sbInsert(table, row, { onConflict = null } = {}) {
  // onConflict: nombre de columna única → los duplicados se ignoran (idempotencia).
  const prefer = onConflict ? 'resolution=ignore-duplicates,return=representation' : 'return=representation';
  const qs = onConflict ? `?on_conflict=${onConflict}` : '';
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}${qs}`, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': prefer }),
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error(`Supabase insert ${table} ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function sbUpdate(table, query, patch) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: sbHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(patch)
  });
  if (!r.ok) throw new Error(`Supabase update ${table} ${r.status}: ${await r.text()}`);
  return r.json();
}

export async function sbSignedUrl(path, expiresIn = 3600) {
  const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/formaciones/${path}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify({ expiresIn })
  });
  if (!r.ok) throw new Error(`Supabase sign ${path} ${r.status}: ${await r.text()}`);
  const { signedURL } = await r.json();
  return `${process.env.SUPABASE_URL}/storage/v1${signedURL}`;
}

// ---------- Acceso (magic link) ----------

export function nuevoToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Devuelve el acceso (creándolo si no existe) y añade el producto si falta.
export async function otorgarAcceso(email, producto, nombre) {
  const existentes = await sbSelect('formaciones_accesos', `email=eq.${encodeURIComponent(email)}&select=*`);
  if (existentes.length > 0) {
    const acc = existentes[0];
    const productos = acc.productos.includes(producto) ? acc.productos : [...acc.productos, producto];
    const patch = { productos, revocado: false };
    if (nombre && !acc.nombre) patch.nombre = nombre;
    const [actualizado] = await sbUpdate('formaciones_accesos', `id=eq.${acc.id}`, patch);
    return actualizado;
  }
  const [creado] = await sbInsert('formaciones_accesos', {
    email, nombre: nombre || null, token: nuevoToken(), productos: [producto]
  });
  return creado;
}

// ---------- Email (Resend) ----------

export async function resendSend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Email de acceso al aula (con la marca: crema/marrón/dorado).
export function emailAccesoAula({ nombre, productos, esCompra }) {
  const safeName = escapeHtml(nombre) || 'allí';
  const lista = productos.map(p => `<li style="padding:2px 0">${escapeHtml(PROGRAMAS[p]?.nombre || p)}</li>`).join('');
  const titulo = esCompra ? '¡Bienvenida/o a Renacer en casa!' : 'Tu acceso al aula';
  const intro = esCompra
    ? 'Tu compra se ha completado y tu plaza ya está lista. Este es tu enlace personal de acceso al aula — guárdalo: es tu llave, para siempre.'
    : 'Aquí tienes de nuevo tu enlace personal de acceso al aula. Guárdalo: es tu llave, para siempre.';
  return {
    subject: esCompra ? 'Tu acceso a Renacer en casa 🌿' : 'Tu enlace de acceso al aula 🌿',
    html: `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px;background:#F8F1E3;color:#5B4128;border-radius:14px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#5B4128;color:#F8F1E3;line-height:48px;font-size:22px">R</div>
        <h1 style="font-weight:500;color:#5B4128;margin:12px 0 0;font-size:24px">Studio Renacer</h1>
        <p style="margin:4px 0 0;font-size:13px;color:#7A6A53">Renacer en casa · Aula</p>
      </div>
      <p>Hola ${safeName},</p>
      <p><strong>${titulo}</strong></p>
      <p>${intro}</p>
      <p style="margin-bottom:6px">Tus programas:</p>
      <ul style="margin-top:0">${lista}</ul>
      <div style="text-align:center;margin:28px 0">
        <a href="{{ENLACE}}" style="display:inline-block;background:#5B4128;color:#F8F1E3;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:600;font-size:15px">Entrar al aula</a>
      </div>
      <p style="font-size:12px;color:#7A6A53">Si el botón no funciona, copia este enlace en tu navegador:<br>
        <a href="{{ENLACE}}" style="color:#2C3E54;word-break:break-all">{{ENLACE}}</a></p>
      <p style="font-size:12px;color:#7A6A53">Este enlace es personal: no lo compartas. Si lo pierdes, puedes pedir uno nuevo con tu email en la página del aula.</p>
      <p style="margin-top:24px">Con cariño,<br>Andrea Fernández<br><i>Psicóloga colegiada 27327 · Studio Renacer</i></p>
      <hr style="border:none;border-top:1px solid #E7DCC6;margin:24px 0">
      <p style="font-size:11px;color:#7A6A53">Los programas de Renacer en casa son psicoeducación y autotrabajo guiado; no son terapia ni sustituyen la atención psicológica individual. Si estás en crisis, llama al 024 (conducta suicida) o al 112 (emergencias).</p>
    </div>`
  };
}

export async function enviarMagicLink(acceso, { esCompra = false } = {}) {
  const from = process.env.FROM_EMAIL || 'Studio Renacer <admin@studiorenacer.com>';
  const enlace = `${AULA_URL}?token=${acceso.token}`;
  const tpl = emailAccesoAula({ nombre: acceso.nombre, productos: acceso.productos, esCompra });
  await resendSend({
    from,
    to: [acceso.email],
    subject: tpl.subject,
    html: tpl.html.replaceAll('{{ENLACE}}', enlace)
  });
}
