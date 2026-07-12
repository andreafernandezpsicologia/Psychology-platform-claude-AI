// /api/aula-file.js
// GET ?f=<ruta>&token=<token> → verifica el acceso y redirige a una URL firmada
// (1 hora) del bucket privado "formaciones" en Supabase Storage.
// Así los PDF del programa no están públicos ni viven en el repo.

import { ARCHIVOS, sbSelect, sbSignedUrl } from './_aula.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = String(req.query.token || '').trim();
  const file = String(req.query.f || '').trim();

  const permitidos = ARCHIVOS[file];
  if (!permitidos) return res.status(404).json({ error: 'Archivo no encontrado' });
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Acceso no válido' });

  try {
    const rows = await sbSelect('formaciones_accesos',
      `token=eq.${token}&revocado=eq.false&select=productos`);
    if (rows.length === 0) return res.status(401).json({ error: 'Acceso no válido' });

    const productos = rows[0].productos || [];
    if (!permitidos.some(p => productos.includes(p))) {
      return res.status(403).json({ error: 'Este archivo no pertenece a tus programas' });
    }

    const url = await sbSignedUrl(file, 3600);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
  } catch (err) {
    console.error('[aula-file] error:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
