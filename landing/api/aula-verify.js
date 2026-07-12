// /api/aula-verify.js
// GET ?token=... → comprueba el token de acceso al aula y devuelve los programas.
// Lo usan las páginas /renacer-en-casa/aula y /renacer-en-casa/aula/calma.

import { applyCors, sbSelect, sbUpdate } from './_aula.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.query.token || '').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ ok: false });

  try {
    const rows = await sbSelect('formaciones_accesos',
      `token=eq.${token}&revocado=eq.false&select=id,nombre,productos`);
    if (rows.length === 0) return res.status(401).json({ ok: false });

    const acc = rows[0];
    // Registro de último acceso (best effort, no bloquea la respuesta).
    sbUpdate('formaciones_accesos', `id=eq.${acc.id}`, { last_access_at: new Date().toISOString() })
      .catch(err => console.warn('[aula-verify] last_access_at:', err.message));

    return res.status(200).json({ ok: true, nombre: acc.nombre, productos: acc.productos });
  } catch (err) {
    console.error('[aula-verify] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
