// /api/subscribe.js
// Vercel Serverless Function (Node 18+)
// Recibe los datos del formulario de waitlist y:
//   1) Envía un correo de aviso a Andrea (info@studiorenacer.com)
//   2) Envía un correo de confirmación al usuario
//   3) (Opcional) Añade el contacto a una audiencia de Resend
//
// Variables de entorno requeridas en Vercel:
//   RESEND_API_KEY        → tu API key de Resend (https://resend.com/api-keys)
//   NOTIFY_TO             → e-mail donde Andrea recibe los avisos (info@studiorenacer.com)
//   FROM_EMAIL            → remitente verificado (ej: "Studio Renacer <hola@studiorenacer.com>")
// Opcional:
//   RESEND_AUDIENCE_ID    → ID de la audiencia en Resend para guardar contactos

export default async function handler(req, res) {
  // CORS básico (la landing y el endpoint comparten dominio, así que normalmente no se necesita)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name    = (body.name    || '').trim().slice(0, 120);
    const email   = (body.email   || '').trim().toLowerCase().slice(0, 200);
    const phone   = (body.phone   || '').trim().slice(0, 40);
    const consent = !!body.consent;
    const lang    = ['es','en','da'].includes(body.lang) ? body.lang : 'es';

    // Validación servidor
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (!consent) {
      return res.status(400).json({ error: 'Consentimiento RGPD requerido' });
    }

    const apiKey   = process.env.RESEND_API_KEY;
    const notifyTo = process.env.NOTIFY_TO   || 'info@studiorenacer.com';
    const from     = process.env.FROM_EMAIL  || 'Studio Renacer <hola@studiorenacer.com>';
    const audId    = process.env.RESEND_AUDIENCE_ID; // opcional

    if (!apiKey) {
      console.error('RESEND_API_KEY missing');
      return res.status(500).json({ error: 'Servicio no configurado' });
    }

    // ---------- 1) Aviso a Andrea ----------
    const adminHtml = `
      <h2 style="font-family:sans-serif;color:#1e3a5f">Nueva persona en la lista de espera</h2>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 12px;color:#7e8a9c">Nombre</td><td style="padding:6px 12px"><b>${escapeHtml(name) || '—'}</b></td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Email</td><td style="padding:6px 12px"><b>${escapeHtml(email)}</b></td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Teléfono</td><td style="padding:6px 12px">${escapeHtml(phone) || '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Idioma</td><td style="padding:6px 12px">${lang.toUpperCase()}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">RGPD</td><td style="padding:6px 12px">${consent ? '✓ aceptado' : '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Fecha</td><td style="padding:6px 12px">${new Date().toISOString()}</td></tr>
      </table>
    `;

    await resendSend(apiKey, {
      from,
      to: [notifyTo],
      subject: `Nueva inscripción · ${name || email}`,
      html: adminHtml,
      reply_to: email
    });

    // ---------- 2) Confirmación al usuario ----------
    const userMsg = userEmailTemplates(lang, name);
    await resendSend(apiKey, {
      from,
      to: [email],
      subject: userMsg.subject,
      html: userMsg.html
    });

    // ---------- 3) Añadir a audiencia (opcional) ----------
    if (audId) {
      try {
        await fetch(`https://api.resend.com/audiences/${audId}/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type':  'application/json'
          },
          body: JSON.stringify({
            email,
            first_name: name,
            unsubscribed: false
          })
        });
      } catch (err) {
        console.warn('audience add failed (continuing):', err);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// ---------- helpers ----------
async function resendSend(apiKey, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Resend ${r.status}: ${text}`);
  }
  return r.json();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function userEmailTemplates(lang, name) {
  const safeName = escapeHtml(name) || (lang === 'da' ? 'der' : lang === 'en' ? 'there' : 'allí');
  const greeting = (lang === 'da' ? 'Hej' : lang === 'en' ? 'Hi' : 'Hola');

  const bodies = {
    es: {
      subject: 'Gracias por unirte a Studio Renacer 🌿',
      intro:   '¡Gracias por dejarme tu correo! Quería darte la bienvenida y confirmarte que estás en la lista.',
      body:    'Te avisaré personalmente en cuanto Studio Renacer abra sus puertas (previsto para verano de 2026). Mientras tanto, cuídate mucho.',
      sign:    'Con cariño,<br>Andrea Fernández<br><i>Studio Renacer</i>',
      footer:  'Si no fuiste tú quien se inscribió, simplemente ignora este correo.'
    },
    en: {
      subject: 'Welcome to Studio Renacer 🌿',
      intro:   "Thank you for leaving me your email! I just wanted to welcome you and confirm you're on the list.",
      body:    "I'll personally let you know as soon as Studio Renacer opens its doors (planned for summer 2026). Take good care in the meantime.",
      sign:    'Warmly,<br>Andrea Fernández<br><i>Studio Renacer</i>',
      footer:  "If you didn't sign up, simply ignore this email."
    },
    da: {
      subject: 'Velkommen til Studio Renacer 🌿',
      intro:   'Tak fordi du efterlod din e-mail! Jeg vil gerne byde dig velkommen og bekræfte, at du er på listen.',
      body:    'Jeg giver dig personligt besked, så snart Studio Renacer åbner (planlagt til sommeren 2026). Pas godt på dig selv i mellemtiden.',
      sign:    'Med venlig hilsen,<br>Andrea Fernández<br><i>Studio Renacer</i>',
      footer:  'Hvis du ikke har tilmeldt dig, kan du blot ignorere denne e-mail.'
    }
  };
  const t = bodies[lang] || bodies.es;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1f33">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#1e3a5f;color:#fff;line-height:48px;font-family:Georgia,serif;font-size:22px">R</div>
        <h1 style="font-family:Georgia,serif;font-weight:500;color:#1e3a5f;margin:12px 0 0">Studio Renacer</h1>
      </div>
      <p>${greeting} ${safeName},</p>
      <p>${t.intro}</p>
      <p>${t.body}</p>
      <p style="margin-top:24px">${t.sign}</p>
      <hr style="border:none;border-top:1px solid #e6ebf2;margin:24px 0">
      <p style="font-size:12px;color:#7e8a9c">${t.footer}</p>
    </div>
  `;
  return { subject: t.subject, html };
}
