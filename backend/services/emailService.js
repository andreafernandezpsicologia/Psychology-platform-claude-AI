const { Resend } = require('resend');
const { buildSessionICS } = require('./icsService');
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
  const m = String(fechaHora).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
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
  sendSessionRequestToAdmin,
  sendSessionRequestResult,
};
