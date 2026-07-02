// /api/feedback.js
// Vercel Serverless Function (Node 18+)
// Recibe una opinión/testimonio desde la página privada /opinar y:
//   1) Envía un email a Andrea con TODO el contenido para que lo MODERE (nada se publica solo).
//      Ese email es, además, el registro del consentimiento (contenido + marca de tiempo).
//   2) (Opcional) Envía un email de agradecimiento a la persona, recordando cómo revocar.
//
// NO usa base de datos (minimización de datos: el email a Andrea es el registro).
// Reutiliza las mismas variables de entorno que subscribe.js:
//   RESEND_API_KEY, NOTIFY_TO (info@studiorenacer.com), FROM_EMAIL

export default async function handler(req, res) {
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

    const tipo     = ['terapia', 'formacion'].includes(body.tipo) ? body.tipo : 'formacion';
    const opinion  = (body.opinion || '').trim().slice(0, 800);
    const context  = (body.context || '').trim().slice(0, 200);
    const display  = ['nombre', 'iniciales', 'anonimo'].includes(body.display) ? body.display : 'iniciales';
    const name     = (body.name  || '').trim().slice(0, 80);
    const email    = (body.email || '').trim().toLowerCase().slice(0, 200);
    const lang     = ['es', 'en', 'da'].includes(body.lang) ? body.lang : 'es';
    const consent  = !!body.consent;   // tratamiento de datos
    const publish  = !!body.publish;   // permiso para publicar

    // Validación en servidor
    if (opinion.length < 10) {
      return res.status(400).json({ error: 'Opinión demasiado corta' });
    }
    if (!consent || !publish) {
      return res.status(400).json({ error: 'Consentimiento requerido' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const apiKey   = process.env.RESEND_API_KEY;
    const notifyTo = process.env.NOTIFY_TO  || 'info@studiorenacer.com';
    const from     = process.env.FROM_EMAIL || 'Studio Renacer <hola@studiorenacer.com>';

    if (!apiKey) {
      console.error('[feedback] RESEND_API_KEY no configurada');
      return res.status(500).json({ error: 'Servicio no configurado' });
    }

    // Cómo aparecería públicamente según la elección de la persona (sugerencia para Andrea).
    const displaySuggestion = suggestDisplay(display, name, lang);
    const tipoLabel = tipo === 'terapia' ? 'Proceso de terapia' : 'Sobre la guía / formación';

    const adminHtml = `
      <h2 style="font-family:Georgia,serif;color:#1e3a5f;margin:0 0 4px">Nueva opinión para revisar</h2>
      <p style="font-family:sans-serif;font-size:13px;color:#7e8a9c;margin:0 0 16px">
        Nada se publica automáticamente. Si la apruebas, se añade a la web con la identidad elegida.
      </p>
      <blockquote style="font-family:Georgia,serif;font-size:16px;color:#0f1f33;border-left:3px solid #c9a96e;margin:0 0 16px;padding:4px 0 4px 16px">
        “${escapeHtml(opinion)}”
      </blockquote>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:6px 12px;color:#7e8a9c">Tipo</td><td style="padding:6px 12px"><b>${tipoLabel}</b></td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Contexto</td><td style="padding:6px 12px">${escapeHtml(context) || '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Aparecería como</td><td style="padding:6px 12px"><b>${escapeHtml(displaySuggestion)}</b> <span style="color:#7e8a9c">(elección: ${display})</span></td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Nombre facilitado</td><td style="padding:6px 12px">${escapeHtml(name) || '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Email (contacto/revocación)</td><td style="padding:6px 12px">${escapeHtml(email) || '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Idioma</td><td style="padding:6px 12px">${lang.toUpperCase()}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Consentimiento datos</td><td style="padding:6px 12px">${consent ? '✓' : '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Permiso publicación</td><td style="padding:6px 12px">${publish ? '✓' : '—'}</td></tr>
        <tr><td style="padding:6px 12px;color:#7e8a9c">Fecha</td><td style="padding:6px 12px">${new Date().toISOString()}</td></tr>
      </table>`;

    try {
      await resendSend(apiKey, {
        from,
        to: [notifyTo],
        subject: `Nueva opinión para revisar · ${tipoLabel}`,
        html: adminHtml,
        ...(email ? { reply_to: email } : {})
      });
      console.log('[feedback] ✓ Opinión enviada a Andrea para moderar');
    } catch (err) {
      console.error('[feedback] ✗ Error enviando la opinión a Andrea:', err.message);
      throw err;
    }

    // Agradecimiento opcional a la persona (si dejó email).
    if (email) {
      try {
        await resendSend(apiKey, thankYouEmail(from, email, lang));
        console.log('[feedback] ✓ Agradecimiento enviado');
      } catch (err) {
        console.warn('[feedback] agradecimiento falló (continuando):', err.message);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// ---------- helpers ----------
function suggestDisplay(display, name, lang) {
  const anon = lang === 'da' ? 'Verificeret klient' : lang === 'en' ? 'Verified client' : 'Paciente verificada';
  if (display === 'anonimo' || !name) return anon;
  const parts = name.trim().split(/\s+/);
  if (display === 'iniciales') {
    return parts.map(p => p[0].toUpperCase() + '.').join(' ');
  }
  // 'nombre' → nombre de pila + inicial del segundo término si existe
  const first = parts[0];
  const initial = parts[1] ? ' ' + parts[1][0].toUpperCase() + '.' : '';
  return first + initial;
}

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

function thankYouEmail(from, to, lang) {
  const t = {
    es: {
      subject: 'Gracias por compartir tu experiencia 🌿',
      body: 'Gracias por tomarte el tiempo de contarme tu experiencia. La leeré con calma y, si la publico, será con la identidad protegida que elegiste. Puedes pedir que la retire cuando quieras respondiendo a este correo.',
      sign: 'Con cariño,<br>Andrea Fernández<br><i>Studio Renacer</i>'
    },
    en: {
      subject: 'Thank you for sharing your experience 🌿',
      body: 'Thank you for taking the time to share your experience. I\'ll read it carefully and, if I publish it, it will be with the protected identity you chose. You can ask me to remove it at any time by replying to this email.',
      sign: 'Warmly,<br>Andrea Fernández<br><i>Studio Renacer</i>'
    },
    da: {
      subject: 'Tak fordi du delte din oplevelse 🌿',
      body: 'Tak fordi du tog dig tid til at dele din oplevelse. Jeg læser den i ro, og hvis jeg udgiver den, bliver det med den beskyttede identitet, du valgte. Du kan altid bede mig fjerne den ved at svare på denne e-mail.',
      sign: 'Med venlig hilsen,<br>Andrea Fernández<br><i>Studio Renacer</i>'
    }
  };
  const c = t[lang] || t.es;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f1f33">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#1e3a5f;color:#fff;line-height:48px;font-family:Georgia,serif;font-size:22px">R</div>
        <h1 style="font-family:Georgia,serif;font-weight:500;color:#1e3a5f;margin:12px 0 0">Studio Renacer</h1>
      </div>
      <p>${c.body}</p>
      <p style="margin-top:24px">${c.sign}</p>
    </div>`;
  return { from, to: [to], subject: c.subject, html };
}
