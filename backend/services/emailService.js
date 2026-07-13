const fs = require('fs');
const path = require('path');
const { Resend } = require('resend');
const { buildSessionICS, buildFeedICS } = require('./icsService');
const { FECHA_NAIVE_RE } = require('./fechaPared');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.FROM_EMAIL || 'Studio Renacer <admin@studiorenacer.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Idioma de las comunicaciones al paciente. Andrea lo marca al crear la cuenta
// (users.idioma_preferido) y viaja hasta aquí en cada envío. Fallback: español.
const IDIOMAS = ['es', 'en', 'da'];
const lng = (l) => (IDIOMAS.includes(l) ? l : 'es');
const LOCALE = { es: 'es-ES', en: 'en-GB', da: 'da-DK' };

// Envoltorio común de todos los emails: aplica la maqueta (ancho, tipografía,
// separador y pie de marca) y lo manda por Resend. `body` es el HTML propio de
// cada email (incluido el saludo).
const enviarEmail = ({ to, subject, body, attachments }) =>
  resend.emails.send({
    from: FROM,
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        ${body}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
    ...(attachments ? { attachments } : {}),
  });

// Adjunto .ics en base64 (formato que espera Resend)
const icsAdjunto = (filename, ics) => ({ filename, content: Buffer.from(ics).toString('base64') });

// Guía de bienvenida "Cómo funciona tu área privada" (PDF) por idioma, adjunta al
// email de activación. Se leen una vez al cargar el módulo; si falta el archivo,
// el email se envía sin adjunto (no romper la activación por un adjunto).
const guiaAttachments = {};
for (const l of IDIOMAS) {
  try {
    guiaAttachments[l] = {
      filename: 'Guia-area-privada-Studio-Renacer.pdf',
      content: fs.readFileSync(path.join(__dirname, '..', 'assets', `guia-area-privada-${l}.pdf`)).toString('base64'),
    };
  } catch (err) {
    console.warn(`[emailService] Guía de bienvenida (${l}) no encontrada, se enviará sin adjunto:`, err.message);
  }
}

// fechaHora es hora de pared (Europe/Madrid) sin zona horaria: se construye por
// componentes y se formatea sin timeZone, para que no dependa de la zona del
// servidor (Render corre en UTC).
const formatFechaPared = (fechaHora, lang) => {
  const m = String(fechaHora).match(FECHA_NAIVE_RE);
  if (!m) return String(fechaHora);
  const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return fecha.toLocaleString(LOCALE[lng(lang)], { dateStyle: 'full', timeStyle: 'short' });
};

// ── Diccionario de textos por idioma ──────────────────────────────────────────
const T = {
  es: {
    modalidad: (tipo) => (tipo === 'videollamada' ? 'Videollamada' : 'Presencial'),
    joinButton: 'Unirse a la videollamada',
    joinLink: 'unirse',
    welcome: {
      subject: 'Bienvenido/a a Studio Renacer — Activa tu cuenta',
      greeting: (n) => `Hola, ${n}`,
      created: 'Tu cuenta en Studio Renacer ha sido creada por Andrea.',
      setPassword: 'Haz clic en el botón para establecer tu contraseña y acceder a tu espacio:',
      activate: 'Activar mi cuenta',
      expires: 'El enlace caduca en 7 días.',
      guideNote: 'Te adjunto una guía en PDF con todo lo que necesitas saber: cómo activar tu cuenta, pedir cita, unirte a la videollamada y preparar tu sesión. Cualquier duda, escríbeme.',
    },
    reminder: {
      subject: 'Recordatorio: tu sesión es mañana',
      greeting: (n) => `Hola, ${n}`,
      line: 'Te recuerdo que mañana tienes una sesión de psicología:',
      dateLabel: 'Fecha', modeLabel: 'Modalidad',
      cancelNote: 'Si necesitas cancelar o cambiar la cita, contacta con antelación.',
    },
    confirmation: {
      subjectOne: 'Tu cita está confirmada', subjectMany: 'Tus citas están confirmadas',
      greeting: (n) => `Hola, ${n}`,
      introOne: 'Tu cita ha quedado agendada:', introMany: 'Tus citas han quedado agendadas:',
      attachOne: 'Adjuntamos un archivo para que la añadas a tu calendario.',
      attachMany: 'Adjuntamos un archivo para que las añadas a tu calendario.',
      reminderNote: 'Recibirás un recordatorio el día antes. Si necesitas cambiarla, contacta con antelación.',
    },
    rescheduled: {
      subject: 'Tu cita ha cambiado de fecha',
      greeting: (n) => `Hola, ${n}`,
      line: 'Tu cita se ha movido a una nueva fecha:',
      note: 'Adjuntamos un archivo actualizado para tu calendario. Recibirás un recordatorio el día antes.',
    },
    requestAck: {
      subject: 'Hemos recibido tu solicitud de cita',
      greeting: (n) => `Hola, ${n}`,
      line: 'Hemos recibido tu solicitud de cita para:',
      note: 'Andrea la revisará y te confirmará en breve. Recibirás un email con la respuesta.',
    },
    requestResult: {
      subjectYes: 'Tu cita está confirmada', subjectNo: 'Sobre tu solicitud de cita',
      greeting: (n) => `Hola, ${n}`,
      confirmedLine: 'Tu cita ha sido <strong>confirmada</strong>:',
      dateLabel: 'Fecha', modeLabel: 'Modalidad',
      confirmedAttach: 'Encontrarás el archivo adjunto para añadirla a tu calendario.',
      rejectedLine: (f) => `La hora que solicitaste (<strong>${f}</strong>) no ha podido confirmarse.`,
      rejectedNote: 'Puedes proponer otra hora desde tu espacio personal, o Andrea se pondrá en contacto contigo.',
    },
    packLow: {
      subject: (n) => `Te quedan ${n} sesión${n === 1 ? '' : 'es'} en tu pack`,
      greeting: (n) => `Hola, ${n}`,
      line: 'Te avisamos de que tu pack actual está casi agotado:',
      big: (n) => (n === 1 ? 'Solo te queda 1 sesión disponible.' : `Solo te quedan ${n} sesiones disponibles.`),
      note: 'Si quieres continuar con tu proceso, habla con Andrea para renovar tu pack.',
    },
    passwordReset: {
      subject: 'Studio Renacer — Restablecer contraseña',
      greeting: (n) => `Hola, ${n}`,
      line1: 'Has solicitado restablecer tu contraseña en Studio Renacer.',
      line2: 'Haz clic en el botón para crear una nueva contraseña:',
      button: 'Restablecer contraseña',
      expires: 'El enlace caduca en 1 hora. Si no solicitaste esto, ignora este correo.',
    },
    contrato: {
      subject: 'Studio Renacer — Tu contrato de servicios',
      greeting: (n) => `Hola, ${n}`,
      line1: 'Te adjunto el contrato de servicios de psicología para que lo leas con calma.',
      line2: 'Cuando lo tengas firmado, puedes subirlo desde tu área privada (apartado "Contrato de servicios") o traerlo a la próxima sesión.',
      button: 'Ir a mi área privada',
    },
  },

  en: {
    modalidad: (tipo) => (tipo === 'videollamada' ? 'Video call' : 'In person'),
    joinButton: 'Join the video call',
    joinLink: 'join',
    welcome: {
      subject: 'Welcome to Studio Renacer — Activate your account',
      greeting: (n) => `Hi ${n}`,
      created: 'Your Studio Renacer account has been created by Andrea.',
      setPassword: 'Click the button to set your password and access your space:',
      activate: 'Activate my account',
      expires: 'The link expires in 7 days.',
      guideNote: 'I’m attaching a PDF guide with everything you need to know: how to activate your account, book a session, join the video call and get ready for your session. Any questions, just write to me.',
    },
    reminder: {
      subject: 'Reminder: your session is tomorrow',
      greeting: (n) => `Hi ${n}`,
      line: 'Just a reminder that you have a psychology session tomorrow:',
      dateLabel: 'Date', modeLabel: 'Format',
      cancelNote: 'If you need to cancel or change the appointment, please get in touch in advance.',
    },
    confirmation: {
      subjectOne: 'Your appointment is confirmed', subjectMany: 'Your appointments are confirmed',
      greeting: (n) => `Hi ${n}`,
      introOne: 'Your appointment has been scheduled:', introMany: 'Your appointments have been scheduled:',
      attachOne: 'We’re attaching a file so you can add it to your calendar.',
      attachMany: 'We’re attaching a file so you can add them to your calendar.',
      reminderNote: 'You’ll get a reminder the day before. If you need to change it, please get in touch in advance.',
    },
    rescheduled: {
      subject: 'Your appointment has been moved',
      greeting: (n) => `Hi ${n}`,
      line: 'Your appointment has been moved to a new date:',
      note: 'We’re attaching an updated file for your calendar. You’ll get a reminder the day before.',
    },
    requestAck: {
      subject: 'We’ve received your appointment request',
      greeting: (n) => `Hi ${n}`,
      line: 'We’ve received your appointment request for:',
      note: 'Andrea will review it and confirm shortly. You’ll receive an email with the reply.',
    },
    requestResult: {
      subjectYes: 'Your appointment is confirmed', subjectNo: 'About your appointment request',
      greeting: (n) => `Hi ${n}`,
      confirmedLine: 'Your appointment has been <strong>confirmed</strong>:',
      dateLabel: 'Date', modeLabel: 'Format',
      confirmedAttach: 'You’ll find the attached file to add it to your calendar.',
      rejectedLine: (f) => `The time you requested (<strong>${f}</strong>) couldn’t be confirmed.`,
      rejectedNote: 'You can propose another time from your personal space, or Andrea will get in touch with you.',
    },
    packLow: {
      subject: (n) => `You have ${n} session${n === 1 ? '' : 's'} left in your pack`,
      greeting: (n) => `Hi ${n}`,
      line: 'We’re letting you know that your current pack is almost used up:',
      big: (n) => (n === 1 ? 'You only have 1 session left.' : `You only have ${n} sessions left.`),
      note: 'If you’d like to continue your process, talk to Andrea to renew your pack.',
    },
    passwordReset: {
      subject: 'Studio Renacer — Reset your password',
      greeting: (n) => `Hi ${n}`,
      line1: 'You’ve requested to reset your password at Studio Renacer.',
      line2: 'Click the button to create a new password:',
      button: 'Reset password',
      expires: 'The link expires in 1 hour. If you didn’t request this, please ignore this email.',
    },
    contrato: {
      subject: 'Studio Renacer — Your service agreement',
      greeting: (n) => `Hi ${n}`,
      line1: 'I’m attaching the psychology service agreement so you can read it calmly.',
      line2: 'Once signed, you can upload it from your private area ("Service agreement" section) or bring it to your next session.',
      button: 'Go to my private area',
    },
  },

  da: {
    modalidad: (tipo) => (tipo === 'videollamada' ? 'Videoopkald' : 'Fysisk'),
    joinButton: 'Deltag i videoopkaldet',
    joinLink: 'deltag',
    welcome: {
      subject: 'Velkommen til Studio Renacer — Aktivér din konto',
      greeting: (n) => `Hej ${n}`,
      created: 'Din konto hos Studio Renacer er oprettet af Andrea.',
      setPassword: 'Klik på knappen for at oprette din adgangskode og få adgang til dit rum:',
      activate: 'Aktivér min konto',
      expires: 'Linket udløber om 7 dage.',
      guideNote: 'Jeg vedhæfter en PDF-guide med alt, du har brug for at vide: hvordan du aktiverer din konto, bestiller en tid, deltager i videoopkaldet og gør klar til din session. Har du spørgsmål, så skriv til mig.',
    },
    reminder: {
      subject: 'Påmindelse: din session er i morgen',
      greeting: (n) => `Hej ${n}`,
      line: 'Blot en påmindelse om, at du har en psykologsession i morgen:',
      dateLabel: 'Dato', modeLabel: 'Form',
      cancelNote: 'Har du brug for at aflyse eller ændre tiden, så kontakt mig i god tid.',
    },
    confirmation: {
      subjectOne: 'Din tid er bekræftet', subjectMany: 'Dine tider er bekræftet',
      greeting: (n) => `Hej ${n}`,
      introOne: 'Din tid er planlagt:', introMany: 'Dine tider er planlagt:',
      attachOne: 'Vi vedhæfter en fil, så du kan tilføje den til din kalender.',
      attachMany: 'Vi vedhæfter en fil, så du kan tilføje dem til din kalender.',
      reminderNote: 'Du får en påmindelse dagen før. Har du brug for at ændre den, så kontakt mig i god tid.',
    },
    rescheduled: {
      subject: 'Din tid er flyttet',
      greeting: (n) => `Hej ${n}`,
      line: 'Din tid er flyttet til en ny dato:',
      note: 'Vi vedhæfter en opdateret fil til din kalender. Du får en påmindelse dagen før.',
    },
    requestAck: {
      subject: 'Vi har modtaget din anmodning om tid',
      greeting: (n) => `Hej ${n}`,
      line: 'Vi har modtaget din anmodning om tid til:',
      note: 'Andrea gennemgår den og bekræfter snarest. Du modtager en e-mail med svaret.',
    },
    requestResult: {
      subjectYes: 'Din tid er bekræftet', subjectNo: 'Om din anmodning om tid',
      greeting: (n) => `Hej ${n}`,
      confirmedLine: 'Din tid er blevet <strong>bekræftet</strong>:',
      dateLabel: 'Dato', modeLabel: 'Form',
      confirmedAttach: 'Du finder den vedhæftede fil, så du kan tilføje den til din kalender.',
      rejectedLine: (f) => `Det tidspunkt, du anmodede om (<strong>${f}</strong>), kunne ikke bekræftes.`,
      rejectedNote: 'Du kan foreslå et andet tidspunkt fra dit personlige rum, eller Andrea kontakter dig.',
    },
    packLow: {
      subject: (n) => `Du har ${n} session${n === 1 ? '' : 'er'} tilbage i din pakke`,
      greeting: (n) => `Hej ${n}`,
      line: 'Vi gør dig opmærksom på, at din nuværende pakke næsten er brugt op:',
      big: (n) => (n === 1 ? 'Du har kun 1 session tilbage.' : `Du har kun ${n} sessioner tilbage.`),
      note: 'Vil du fortsætte dit forløb, så tal med Andrea om at forny din pakke.',
    },
    passwordReset: {
      subject: 'Studio Renacer — Nulstil din adgangskode',
      greeting: (n) => `Hej ${n}`,
      line1: 'Du har anmodet om at nulstille din adgangskode hos Studio Renacer.',
      line2: 'Klik på knappen for at oprette en ny adgangskode:',
      button: 'Nulstil adgangskode',
      expires: 'Linket udløber om 1 time. Har du ikke anmodet om dette, så se bort fra denne e-mail.',
    },
    contrato: {
      subject: 'Studio Renacer — Din serviceaftale',
      greeting: (n) => `Hej ${n}`,
      line1: 'Jeg vedhæfter aftalen om psykologydelser, så du kan læse den i ro og mag.',
      line2: 'Når den er underskrevet, kan du uploade den fra dit private rum (afsnittet "Serviceaftale") eller tage den med til din næste session.',
      button: 'Gå til mit private rum',
    },
  },
};

// Botón "Unirse a la videollamada": solo si la sesión es de ese tipo y ya tiene enlace.
const botonVideollamada = (sesion, t) => {
  if (sesion.tipo !== 'videollamada' || !sesion.enlace_videollamada) return '';
  return `
        <a href="${sesion.enlace_videollamada}"
           style="display:inline-block;background:#5B4128;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:12px 0;">
          ${t.joinButton}
        </a>`;
};

// conGuia: Andrea decide al crear la cuenta si se adjunta la guía PDF (en altas
// presenciales ya se lo explica ella y el adjunto sobra).
const sendWelcomeEmail = async (email, nombre, activationToken, lang, conGuia = true) => {
  const l = lng(lang); const t = T[l].welcome;
  // lang viaja en el enlace para que la pantalla de activación (y el texto del
  // consentimiento RGPD) salgan en el idioma del paciente, no en el del navegador.
  const activationLink = `${FRONTEND_URL}/activate?token=${activationToken}&lang=${l}`;
  const adjuntarGuia = conGuia && guiaAttachments[l];
  await enviarEmail({
    to: email,
    subject: t.subject,
    body: `
        <h2>${t.greeting(nombre)}</h2>
        <p>${t.created}</p>
        <p>${t.setPassword}</p>
        <a href="${activationLink}"
           style="display:inline-block;background:#6b5b95;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          ${t.activate}
        </a>
        <p style="color:#888;font-size:13px;">${t.expires}</p>
        ${adjuntarGuia ? `<p>${t.guideNote}</p>` : ''}`,
    ...(adjuntarGuia ? { attachments: [guiaAttachments[l]] } : {}),
  });
};

const sendSessionReminder = async (email, nombre, sesion, lang) => {
  const l = lng(lang); const t = T[l];
  const fecha = formatFechaPared(sesion.fecha_hora, l);
  await enviarEmail({
    to: email,
    subject: t.reminder.subject,
    body: `
        <h2>${t.reminder.greeting(nombre)}</h2>
        <p>${t.reminder.line}</p>
        <p><strong>${t.reminder.dateLabel}:</strong> ${fecha}</p>
        <p><strong>${t.reminder.modeLabel}:</strong> ${t.modalidad(sesion.tipo)}</p>
        ${botonVideollamada(sesion, t)}
        <p>${t.reminder.cancelNote}</p>`,
    attachments: [icsAdjunto('cita-studio-renacer.ics', buildSessionICS(sesion))],
  });
};

// Confirmación inmediata al paciente cuando Andrea crea una cita (1 o serie).
const sendSessionConfirmation = async (email, nombre, sesiones, lang) => {
  const l = lng(lang); const t = T[l]; const c = t.confirmation;
  const lista = [...sesiones].sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)));
  const varias = lista.length > 1;
  const filas = lista
    .map((s) => {
      const modalidad = t.modalidad(s.tipo);
      const enlace = s.tipo === 'videollamada' && s.enlace_videollamada
        ? ` — <a href="${s.enlace_videollamada}">${t.joinLink}</a>`
        : '';
      return `<li><strong>${formatFechaPared(s.fecha_hora, l)}</strong> · ${modalidad}${enlace}</li>`;
    })
    .join('');
  const ics = varias
    ? buildFeedICS(lista, 'Studio Renacer — Tus citas')
    : buildSessionICS(lista[0]);

  await enviarEmail({
    to: email,
    subject: varias ? c.subjectMany : c.subjectOne,
    body: `
        <h2>${c.greeting(nombre)}</h2>
        <p>${varias ? c.introMany : c.introOne}</p>
        <ul>${filas}</ul>
        ${!varias ? botonVideollamada(lista[0], t) : ''}
        <p>${varias ? c.attachMany : c.attachOne}</p>
        <p>${c.reminderNote}</p>`,
    attachments: [icsAdjunto(varias ? 'citas-studio-renacer.ics' : 'cita-studio-renacer.ics', ics)],
  });
};

const sendSessionRescheduled = async (email, nombre, sesion, fechaAnterior, lang) => {
  const l = lng(lang); const t = T[l]; const r = t.rescheduled;
  await enviarEmail({
    to: email,
    subject: r.subject,
    body: `
        <h2>${r.greeting(nombre)}</h2>
        <p>${r.line}</p>
        <p style="color:#888;text-decoration:line-through;">${formatFechaPared(fechaAnterior, l)}</p>
        <p><strong>${formatFechaPared(sesion.fecha_hora, l)}</strong> · ${t.modalidad(sesion.tipo)}</p>
        ${botonVideollamada(sesion, t)}
        <p>${r.note}</p>`,
    attachments: [icsAdjunto('cita-studio-renacer.ics', buildSessionICS(sesion))],
  });
};

const sendSessionRequestAck = async (email, nombre, sesion, lang) => {
  const l = lng(lang); const t = T[l]; const a = t.requestAck;
  await enviarEmail({
    to: email,
    subject: a.subject,
    body: `
        <h2>${a.greeting(nombre)}</h2>
        <p>${a.line}</p>
        <p><strong>${formatFechaPared(sesion.fecha_hora, l)}</strong> · ${t.modalidad(sesion.tipo)}</p>
        <p>${a.note}</p>`,
  });
};

// Aviso a Andrea (admin): siempre en español.
const sendSessionRequestToAdmin = async (adminEmail, pacienteNombre, sesion) => {
  const t = T.es;
  const fecha = formatFechaPared(sesion.fecha_hora, 'es');
  await enviarEmail({
    to: adminEmail,
    subject: `Nueva solicitud de cita — ${pacienteNombre}`,
    body: `
        <h2>Nueva solicitud de cita</h2>
        <p><strong>${pacienteNombre}</strong> ha pedido una cita:</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Modalidad:</strong> ${t.modalidad(sesion.tipo)}</p>
        <a href="${FRONTEND_URL}/admin/calendario"
           style="display:inline-block;background:#1a2d4a;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Confirmar o rechazar en el calendario
        </a>`,
  });
};

const sendSessionRequestResult = async (email, nombre, sesion, confirmada, lang) => {
  const l = lng(lang); const t = T[l]; const r = t.requestResult;
  const fecha = formatFechaPared(sesion.fecha_hora, l);
  await enviarEmail({
    to: email,
    subject: confirmada ? r.subjectYes : r.subjectNo,
    body: `
        <h2>${r.greeting(nombre)}</h2>
        ${confirmada
          ? `<p>${r.confirmedLine}</p>
             <p><strong>${r.dateLabel}:</strong> ${fecha}</p>
             <p><strong>${r.modeLabel}:</strong> ${t.modalidad(sesion.tipo)}</p>
             ${botonVideollamada(sesion, t)}
             <p>${r.confirmedAttach}</p>`
          : `<p>${r.rejectedLine(fecha)}</p>
             <p>${r.rejectedNote}</p>`}`,
    attachments: confirmada ? [icsAdjunto('cita-studio-renacer.ics', buildSessionICS(sesion))] : undefined,
  });
};

const sendPasswordResetEmail = async (email, nombre, resetToken, lang) => {
  const t = T[lng(lang)].passwordReset;
  const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  await enviarEmail({
    to: email,
    subject: t.subject,
    body: `
        <h2>${t.greeting(nombre)}</h2>
        <p>${t.line1}</p>
        <p>${t.line2}</p>
        <a href="${resetLink}"
           style="display:inline-block;background:#1a2d4a;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          ${t.button}
        </a>
        <p style="color:#888;font-size:13px;">${t.expires}</p>`,
  });
};

// Contrato de servicios predeterminado (PDF). Se lee una vez al cargar el módulo;
// si falta el archivo, el endpoint que lo usa devolverá error controlado.
let contratoAttachment = null;
try {
  contratoAttachment = {
    filename: 'Contrato_de_Servicios_Studio_Renacer.pdf',
    content: fs.readFileSync(path.join(__dirname, '..', 'assets', 'contrato-servicios.pdf')).toString('base64'),
  };
} catch (err) {
  console.warn('[emailService] Contrato predeterminado no encontrado:', err.message);
}

// Andrea envía al paciente el contrato predeterminado para firmar.
const sendContratoEmail = async (email, nombre, lang) => {
  if (!contratoAttachment) throw new Error('Plantilla del contrato no disponible en el servidor');
  const t = T[lng(lang)].contrato;
  await enviarEmail({
    to: email,
    subject: t.subject,
    body: `
        <h2>${t.greeting(nombre)}</h2>
        <p>${t.line1}</p>
        <p>${t.line2}</p>
        <a href="${FRONTEND_URL}/paciente"
           style="display:inline-block;background:#5B4128;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          ${t.button}
        </a>`,
    attachments: [contratoAttachment],
  });
};

const sendPackLowAlert = async (email, nombre, sesionesRestantes, lang) => {
  const t = T[lng(lang)].packLow;
  await enviarEmail({
    to: email,
    subject: t.subject(sesionesRestantes),
    body: `
        <h2>${t.greeting(nombre)}</h2>
        <p>${t.line}</p>
        <p style="font-size: 1.2rem; font-weight: bold; color: #1a2d4a;">${t.big(sesionesRestantes)}</p>
        <p>${t.note}</p>`,
  });
};

module.exports = {
  sendWelcomeEmail,
  sendSessionReminder,
  sendPasswordResetEmail,
  sendPackLowAlert,
  sendSessionConfirmation,
  sendSessionRescheduled,
  sendSessionRequestAck,
  sendSessionRequestToAdmin,
  sendSessionRequestResult,
  sendContratoEmail,
};
