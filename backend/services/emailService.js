const { Resend } = require('resend');
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

const sendSessionReminder = async (email, nombre, fechaHora, tipo) => {
  const fecha = new Date(fechaHora).toLocaleString('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Recordatorio: tu sesión es mañana',
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #333;">
        <h2>Hola, ${nombre}</h2>
        <p>Te recuerdo que mañana tienes una sesión de psicología:</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Modalidad:</strong> ${tipo === 'videollamada' ? 'Videollamada' : 'Presencial'}</p>
        <p>Si necesitas cancelar o cambiar la cita, contacta con antelación.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;">Studio Renacer · studiorenacer.com</p>
      </div>
    `,
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

module.exports = { sendWelcomeEmail, sendSessionReminder, sendPasswordResetEmail, sendPackLowAlert };
