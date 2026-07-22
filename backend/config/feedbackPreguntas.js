// Catálogo de preguntas de feedback clínico. Debe mantenerse en sync con el
// gemelo del frontend (frontend/src/config/feedbackPreguntas.js). Aquí solo
// van los datos que el backend necesita para VALIDAR (id + tipo de escala);
// las etiquetas y traducciones viven en el frontend.
//
//   escala:     deslizador 0-10 (más = mejor)
//   frecuencia: opción categórica 0..(niveles-1) (más = peor; se pinta aparte)
const PREGUNTAS = {
  ors: [
    { id: 'animo', tipo: 'escala' },
    { id: 'trabajo', tipo: 'escala' },
    { id: 'ansiedad', tipo: 'frecuencia', niveles: 5 },
  ],
  srs: [
    { id: 'escucha', tipo: 'escala' },
    { id: 'objetivos', tipo: 'escala' },
    { id: 'enfoque', tipo: 'escala' },
    { id: 'global', tipo: 'escala' },
  ],
};

// Valida `respuestas` (objeto {id: valor}) contra el catálogo del tipo dado.
// Devuelve { ok: true, limpio } con solo las claves válidas y valores
// normalizados, o { ok: false, error }.
function validarRespuestas(tipo, respuestas) {
  const defs = PREGUNTAS[tipo];
  if (!defs) return { ok: false, error: 'tipo inválido' };
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) {
    return { ok: false, error: 'respuestas debe ser un objeto' };
  }
  const limpio = {};
  for (const def of defs) {
    const v = respuestas[def.id];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      return { ok: false, error: `falta o es inválida la respuesta "${def.id}"` };
    }
    if (def.tipo === 'escala') {
      if (v < 0 || v > 10) return { ok: false, error: `"${def.id}" fuera de rango (0-10)` };
      limpio[def.id] = Math.round(v * 10) / 10;
    } else { // frecuencia
      if (!Number.isInteger(v) || v < 0 || v > def.niveles - 1) {
        return { ok: false, error: `"${def.id}" fuera de rango (0-${def.niveles - 1})` };
      }
      limpio[def.id] = v;
    }
  }
  return { ok: true, limpio };
}

module.exports = { PREGUNTAS, validarRespuestas };
