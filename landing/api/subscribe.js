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
  // CORS restringido al dominio de la landing
  const allowedOrigins = ['https://www.studiorenacer.com', 'https://studiorenacer.com'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
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
      console.error('[subscribe] RESEND_API_KEY no configurada en las variables de entorno de Vercel');
      return res.status(500).json({ error: 'Servicio no configurado' });
    }

    console.log(`[subscribe] Enviando notificación → from="${from}" to="${notifyTo}" user="${email}"`);

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

    try {
      await resendSend(apiKey, {
        from,
        to: [notifyTo],
        subject: `Nueva inscripción · ${name || email}`,
        html: adminHtml,
        reply_to: email
      });
      console.log('[subscribe] ✓ Email de aviso enviado a Andrea');
    } catch (err) {
      console.error('[subscribe] ✗ Error enviando aviso a Andrea:', err.message);
      throw err;
    }

    // ---------- 2) Entrega de la guía al usuario (PDF según idioma) ----------
    const guideBase = process.env.GUIDE_BASE_URL || 'https://www.studiorenacer.com/assets/';
    const GUIDES = {
      es: ['guia-ansiedad-laboral-studio-renacer.pdf', 'Guia-5-senales-ansiedad-laboral-Studio-Renacer.pdf'],
      en: ['guide-work-anxiety-studio-renacer.pdf',     'Guide-5-signs-work-anxiety-Studio-Renacer.pdf'],
      da: ['guide-arbejdsangst-studio-renacer.pdf',     'Guide-5-tegn-arbejdsangst-Studio-Renacer.pdf']
    };
    const [guideFile, guideName] = GUIDES[lang] || GUIDES.es;
    const guideUrl  = guideBase + guideFile;
    const userMsg   = userEmailTemplates(lang, name, guideUrl);
    const baseUserPayload = { from, to: [email], subject: userMsg.subject, html: userMsg.html };
    try {
      // Adjuntamos la guía (Resend la descarga desde la URL pública) y, además, la enlazamos en el cuerpo.
      await resendSend(apiKey, {
        ...baseUserPayload,
        attachments: [{ filename: guideName, path: guideUrl }]
      });
      console.log('[subscribe] ✓ Guía enviada al usuario (con adjunto)');
    } catch (err) {
      // Si el adjunto falla (p. ej. la URL aún no es accesible), reenviamos solo con el enlace.
      console.warn('[subscribe] adjunto falló, reintento solo con enlace:', err.message);
      try {
        await resendSend(apiKey, baseUserPayload);
        console.log('[subscribe] ✓ Guía enviada al usuario (solo enlace)');
      } catch (err2) {
        console.error('[subscribe] ✗ Error enviando la guía al usuario:', err2.message);
        throw err2;
      }
    }

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

function userEmailTemplates(lang, name, guideUrl) {
  const safeName = escapeHtml(name) || (lang === 'da' ? 'der' : lang === 'en' ? 'there' : 'allí');
  const greeting = (lang === 'da' ? 'Hej' : lang === 'en' ? 'Hi' : 'Hola');
  const href     = escapeHtml(guideUrl || '');

  const bodies = {
    es: {
      subject: 'Tu guía: 5 señales de que tu ansiedad es laboral 🌿',
      intro:   '¡Aquí tienes tu guía! Gracias por dejarme tu correo.',
      body:    'Te he preparado «5 señales de que tu ansiedad es laboral — y qué hacer». Es psicoeducación para entenderte mejor (no un diagnóstico): léela con calma y quédate con el primer paso que más te encaje.',
      cta:     'Descargar la guía (PDF)',
      ps:      'Serás también de las primeras en saberlo cuando Studio Renacer abra sus puertas (verano de 2026). Si te apetece, responde a este correo y me cuentas cómo estás.',
      linkhint:'Si el botón no funciona, copia este enlace en tu navegador:',
      sign:    'Con cariño,<br>Andrea Fernández<br><i>Psicóloga colegiada · Studio Renacer</i>',
      footer:  'Si no fuiste tú quien se inscribió, simplemente ignora este correo.'
    },
    en: {
      subject: 'Your guide: 5 signs your anxiety is work-related 🌿',
      intro:   "Here's your guide! Thank you for leaving me your email.",
      body:    "I've put together “5 signs your anxiety is work-related — and what to do.” It's psychoeducation to help you understand yourself better (not a diagnosis): read it calmly and keep the first step that fits you best.",
      cta:     'Download the guide (PDF)',
      ps:      "You'll also be among the first to know when Studio Renacer opens (summer 2026). If you feel like it, just reply to this email and tell me how you are.",
      linkhint:"If the button doesn't work, copy this link into your browser:",
      sign:    'Warmly,<br>Andrea Fernández<br><i>Licensed psychologist · Studio Renacer</i>',
      footer:  "If you didn't sign up, simply ignore this email."
    },
    da: {
      subject: 'Din guide: 5 tegn på, at din angst er arbejdsrelateret 🌿',
      intro:   'Her er din guide! Tak fordi du efterlod din e-mail.',
      body:    'Jeg har lavet »5 tegn på, at din angst er arbejdsrelateret — og hvad du kan gøre«. Det er psykoedukation, der hjælper dig med at forstå dig selv bedre (ikke en diagnose): læs den i ro og behold det første skridt, der passer dig bedst.',
      cta:     'Download guiden (PDF)',
      ps:      'Du er også blandt de første til at vide det, når Studio Renacer åbner (sommeren 2026). Har du lyst, så svar bare på denne e-mail og fortæl, hvordan du har det.',
      linkhint:'Hvis knappen ikke virker, så kopiér dette link ind i din browser:',
      sign:    'Med venlig hilsen,<br>Andrea Fernández<br><i>Autoriseret psykolog · Studio Renacer</i>',
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
      <div style="text-align:center;margin:28px 0">
        <a href="${href}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:999px;font-weight:600;font-size:15px">${t.cta}</a>
      </div>
      <p style="font-size:12px;color:#7e8a9c;margin-bottom:24px">${t.linkhint}<br>
        <a href="${href}" style="color:#2c5282;word-break:break-all">${href}</a></p>
      <p>${t.ps}</p>
      <p style="margin-top:24px">${t.sign}</p>
      <hr style="border:none;border-top:1px solid #e6ebf2;margin:24px 0">
      <p style="font-size:12px;color:#7e8a9c">${t.footer}</p>
    </div>
  `;
  return { subject: t.subject, html };
}
