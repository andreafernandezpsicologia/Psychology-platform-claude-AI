// /api/aula-acceso.js
// POST { email } → si ese email tiene acceso al aula, le reenvía su magic link.
// Responde siempre "ok" (aunque el email no exista) para no revelar quién es cliente.

import { applyCors, sbSelect, enviarMagicLink } from './_aula.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = (body.email || '').trim().toLowerCase().slice(0, 200);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const rows = await sbSelect('formaciones_accesos',
      `email=eq.${encodeURIComponent(email)}&revocado=eq.false&select=*`);
    if (rows.length > 0) {
      await enviarMagicLink(rows[0], { esCompra: false });
      console.log('[aula-acceso] magic link reenviado');
    } else {
      console.log('[aula-acceso] email sin acceso (respondemos ok igualmente)');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[aula-acceso] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
