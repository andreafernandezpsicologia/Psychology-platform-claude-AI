const express = require('express');
const supabase = require('../services/supabaseClient');
const { sendSessionReminder } = require('../services/emailService');
const { aParedMadrid } = require('../services/fechaPared');

const router = express.Router();

// ── Middleware: solo acepta peticiones con el secreto correcto ────────────────
// Protege el endpoint de invocaciones no autorizadas.
// La cabecera x-cron-secret la envía cron-job.org (o Render cron) en cada llamada.
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron] CRON_SECRET no configurado — endpoint desactivado');
    return res.status(503).json({ error: 'Cron no configurado' });
  }
  if (req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ── POST /api/cron/recordatorios ──────────────────────────────────────────────
// Busca sesiones programadas en las próximas ~24h y envía recordatorio si aún
// no se ha enviado. Diseñado para ejecutarse cada hora desde un servicio externo.
//
// Ventana: desde NOW+20h hasta NOW+26h. Es ancha (6h) a propósito para tolerar
// ejecuciones del cron retrasadas o saltadas, así que cada sesión cae en varias
// ventanas horarias (y el cambio de hora puede desplazarla ±1h). La idempotencia
// NO la da la ventana sino un update condicional (CAS) sobre recordatorio_enviado:
// solo la ejecución que lo pasa de false→true envía, por lo que el solape de
// ventanas nunca genera recordatorios duplicados.
router.post('/recordatorios', requireCronSecret, async (req, res) => {
  try {
    // fecha_hora está en hora de pared de Madrid (TIMESTAMP naive), así que la
    // ventana se calcula también en hora de Madrid — nunca en UTC con toISOString(),
    // que la descuadraría 1-2h según el horario de verano.
    const ahora = new Date();
    const desde = aParedMadrid(new Date(ahora.getTime() + 20 * 60 * 60 * 1000));
    const hasta = aParedMadrid(new Date(ahora.getTime() + 26 * 60 * 60 * 1000));

    const { data: sesiones, error } = await supabase
      .from('sesiones')
      .select(`
        id, fecha_hora, tipo, duracion_minutos,
        pacientes (
          users ( email, nombre_completo )
        )
      `)
      .eq('estado', 'programada')
      .eq('recordatorio_enviado', false)
      .gte('fecha_hora', desde)
      .lte('fecha_hora', hasta);

    if (error) {
      console.error('[cron/recordatorios] Error consultando sesiones:', error.message);
      return res.status(500).json({ error: error.message });
    }

    let enviados = 0;
    let errores = 0;

    for (const sesion of sesiones) {
      const user = sesion.pacientes?.users;
      if (!user?.email) continue;

      // Reclamar el envío con un update condicional (CAS): solo la ejecución que
      // pone recordatorio_enviado de false→true sigue adelante. Hacerlo ANTES de
      // enviar evita el duplicado clásico (enviar y que luego falle el marcado
      // dejaría el flag en false y se reenviaría en la siguiente ventana).
      const { data: claimed, error: claimErr } = await supabase
        .from('sesiones')
        .update({ recordatorio_enviado: true })
        .eq('id', sesion.id)
        .eq('recordatorio_enviado', false)
        .select('id');

      if (claimErr) {
        console.error(`[cron/recordatorios] Error reclamando ${sesion.id}:`, claimErr.message);
        errores++;
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // ya reclamada por otra ejecución

      try {
        await sendSessionReminder(user.email, user.nombre_completo, sesion);
        enviados++;
      } catch (emailErr) {
        console.error(`[cron/recordatorios] Error enviando a ${user.email}:`, emailErr.message);
        errores++;
        // El email falló: liberar el claim para reintentar en la próxima ventana.
        try {
          await supabase
            .from('sesiones')
            .update({ recordatorio_enviado: false })
            .eq('id', sesion.id);
        } catch (revertErr) {
          console.error(`[cron/recordatorios] No se pudo revertir el claim de ${sesion.id}:`, revertErr.message);
        }
      }
    }

    console.log(`[cron/recordatorios] ${enviados} enviados, ${errores} errores — ${new Date().toISOString()}`);
    res.json({ ok: true, enviados, errores, ventana: { desde, hasta } });
  } catch (err) {
    console.error('[cron/recordatorios] Error inesperado:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
