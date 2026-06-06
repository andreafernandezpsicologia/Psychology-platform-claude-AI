const supabase = require('./supabaseClient');

/**
 * Registra una acción en el audit log (RGPD Art. 30)
 * Nunca lanza errores — el audit no debe interrumpir el flujo principal
 */
async function audit(req, action, resource = null, resourceId = null, details = null) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || null;

    const userAgent = req.headers['user-agent']
      ? req.headers['user-agent'].slice(0, 200) // limitar longitud
      : null;

    await supabase.from('audit_log').insert({
      user_id:    req.user?.id   || null,
      user_role:  req.user?.role || null,
      action,
      resource,
      resource_id: resourceId ? String(resourceId) : null,
      ip_address:  ip,
      user_agent:  userAgent,
      details:     details || null,
    });
  } catch (err) {
    // Log interno pero nunca interrumpir la petición
    console.error('[audit-log] Error registrando acción:', err.message);
  }
}

module.exports = { audit };
