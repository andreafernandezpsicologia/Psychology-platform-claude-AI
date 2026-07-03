import api from './api';

// Estado de la integración con Google Meet (solo admin). Se cachea 60s para
// que abrir modales del calendario no dispare una petición cada vez.
let cache = null;
let cacheTs = 0;

export async function estadoGoogle(force = false) {
  if (!force && cache && Date.now() - cacheTs < 60000) return cache;
  try {
    const res = await api.get('/google/estado');
    cache = res.data;
    cacheTs = Date.now();
  } catch {
    cache = { configurado: false, conectado: false, email: null };
    cacheTs = Date.now();
  }
  return cache;
}

export function invalidarEstadoGoogle() {
  cache = null;
}
