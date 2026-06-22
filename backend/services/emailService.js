const { Resend } = require('resend');
const { buildSessionICS, buildFeedICS } = require('./icsService');
const { FECHA_NAIVE_RE } = require('./fechaPared');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.FROM_EMAIL || 'Studio Renacer <admin@studiorenacer.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const sendWelcomeEmail = async (email, nombre, activationToken) => {
  const activationLink = `${FRONTEND_URL}/activate?token=${activationToken}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Bienvenido/a a Studio Renacer — Activa tu cuenta',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Tu cuenta en Studio Renacer ha sido creada por Andrea.</p>
        <p>Haz clic en el botón para establecer tu contraseña y acceder a tu espacio:</p>
        <a href="${activationLink}"
           style="display:inline-block;background:#6b5b95;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Activar mi cuenta
        </a>
        <p style="color:#888;font-size:13px;">El enlace caduca en 7 días.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
  });
};

// fechaHora es hora de pared (Europe/Madrid) sin zona horaria: se construye la
// fecha por componentes y se formatea sin opción timeZone, para que el resultado
// no dependa de la zona horaria del servidor (Render corre en UTC).
const formatFechaPared = (fechaHora) => {
  const m = String(fechaHora).match(FECHA_NAIVE_RE);
  if (!m) return String(fechaHora);
  const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return fecha.toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' });
};

const sendSessionReminder = async (email, nombre, sesion) => {
  const fecha = formatFechaPared(sesion.fecha_hora);

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Recordatorio: tu sesión es mañana',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Te recuerdo que mañana tienes una sesión de psicología:</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Modalidad:</strong> ${sesion.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
        <p>Si necesitas cancelar o cambiar la cita, contacta con antelación.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
    attachments: [
      {
        filename: 'cita-studio-renacer.ics',
        content: Buffer.from(buildSessionICS(sesion)).toString('base64'),
      },
    ],
  });
};

// Confirmación inmediata al paciente cuando Andrea crea una cita (1 o serie).
// Adjunta el .ics: una sola cita o todas las de la serie en un único archivo.
const sendSessionConfirmation = async (email, nombre, sesiones) => {
  const lista = [...sesiones].sort((a, b) => String(a.fecha_hora).localeCompare(String(b.fecha_hora)));
  const varias = lista.length > 1;
  const filas = lista
    .map((s) => `<li><strong>${formatFechaPared(s.fecha_hora)}</strong> · ${s.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</li>`)
    .join('');
  const ics = varias
    ? buildFeedICS(lista, 'Studio Renacer — Tus citas')
    : buildSessionICS(lista[0]);

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: varias ? 'Tus citas están confirmadas' : 'Tu cita está confirmada',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>${varias ? 'Tus citas han quedado agendadas:' : 'Tu cita ha quedado agendada:'}</p>
        <ul>${filas}</ul>
        <p>Adjuntamos un archivo para que ${varias ? 'las añadas' : 'la añadas'} a tu calendario.</p>
        <p>Recibirás un recordatorio el día antes. Si necesitas cambiarla, contacta con antelación.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
    attachments: [
      {
        filename: varias ? 'citas-studio-renacer.ics' : 'cita-studio-renacer.ics',
        content: Buffer.from(ics).toString('base64'),
      },
    ],
  });
};

// Aviso al paciente cuando Andrea reagenda su cita a otra fecha
const sendSessionRescheduled = async (email, nombre, sesion, fechaAnterior) => {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Tu cita ha cambiado de fecha',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Tu cita se ha movido a una nueva fecha:</p>
        <p style="color:#888;text-decoration:line-through;">${formatFechaPared(fechaAnterior)}</p>
        <p><strong>${formatFechaPared(sesion.fecha_hora)}</strong> · ${sesion.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
        <p>Adjuntamos un archivo actualizado para tu calendario. Recibirás un recordatorio el día antes.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
    attachments: [
      {
        filename: 'cita-studio-renacer.ics',
        content: Buffer.from(buildSessionICS(sesion)).toString('base64'),
      },
    ],
  });
};

// Acuse de recibo al paciente cuando solicita una cita (aún sin confirmar)
const sendSessionRequestAck = async (email, nombre, sesion) => {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Hemos recibido tu solicitud de cita',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Hemos recibido tu solicitud de cita para:</p>
        <p><strong>${formatFechaPared(sesion.fecha_hora)}</strong> · ${sesion.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
        <p>Andrea la revisará y te confirmará en breve. Recibirás un email con la respuesta.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
  });
};

// Aviso a Andrea: un paciente ha solicitado una cita
const sendSessionRequestToAdmin = async (adminEmail, pacienteNombre, sesion) => {
  const fecha = formatFechaPared(sesion.fecha_hora);

  await resend.emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Nueva solicitud de cita — ${pacienteNombre}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Nueva solicitud de cita</h2>
        <p><strong>${pacienteNombre}</strong> ha pedido una cita:</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Modalidad:</strong> ${sesion.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
        <a href="${FRONTEND_URL}/admin/calendario"
           style="display:inline-block;background:#1a2d4a;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Confirmar o rechazar en el calendario
        </a>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
  });
};

// Aviso al paciente: su solicitud fue confirmada o rechazada
const sendSessionRequestResult = async (email, nombre, sesion, confirmada) => {
  const fecha = formatFechaPared(sesion.fecha_hora);

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: confirmada ? 'Tu cita está confirmada' : 'Sobre tu solicitud de cita',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        ${confirmada
          ? `<p>Tu cita ha sido <strong>confirmada</strong>:</p>
             <p><strong>Fecha:</strong> ${fecha}</p>
             <p><strong>Modalidad:</strong> ${sesion.tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
             <p>Encontrarás el archivo adjunto para añadirla a tu calendario.</p>`
          : `<p>La hora que solicitaste (<strong>${fecha}</strong>) no ha podido confirmarse.</p>
             <p>Puedes proponer otra hora desde tu espacio personal, o Andrea se pondrá en contacto contigo.</p>`}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
    ...(confirmada ? {
      attachments: [
        {
          filename: 'cita-studio-renacer.ics',
          content: Buffer.from(buildSessionICS(sesion)).toString('base64'),
        },
      ],
    } : {}),
  });
};

const sendPasswordResetEmail = async (email, nombre, resetToken) => {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetLink = `${FRONTEND_URL}/reset-password?token=${resetToken}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Studio Renacer — Restablecer contraseña',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Has solicitado restablecer tu contraseña en Studio Renacer.</p>
        <p>Haz clic en el botón para crear una nueva contraseña:</p>
        <a href="${resetLink}"
           style="display:inline-block;background:#1a2d4a;color:#fff;padding:12px 24px;
                  text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
          Restablecer contraseña
        </a>
        <p style="color:#888;font-size:13px;">El enlace caduca en 1 hora. Si no solicitaste esto, ignora este correo.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
  });
};

const sendPackLowAlert = async (email, nombre, sesionesRestantes) => {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Te quedan ${sesionesRestantes} sesión${sesionesRestantes === 1 ? '' : 'es'} en tu pack`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Te avisamos de que tu pack actual está casi agotado:</p>
        <p style="font-size: 1.2rem; font-weight: bold; color: #1a2d4a;">
          ${sesionesRestantes === 1
            ? 'Solo te queda 1 sesión disponible.'
            : `Solo te quedan ${sesionesRestantes} sesiones disponibles.`}
        </p>
        <p>Si quieres continuar con tu proceso, habla con Andrea para renovar tu pack.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
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
};
