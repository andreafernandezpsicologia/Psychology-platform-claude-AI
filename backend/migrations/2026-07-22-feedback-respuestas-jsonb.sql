-- Rediseño de feedback_sesiones: respuestas flexibles (JSONB)
-- ---------------------------------------------------------------------------
-- El modelo anterior (p1..p4 numéricos + total sumado) asumía 4 deslizadores
-- 0-10 iguales. Las preguntas reales de Andrea no encajan: el ORS tiene 3
-- preguntas y una es de FRECUENCIA (nº de veces con ansiedad), con dirección
-- inversa (más = peor), así que no se puede sumar en un total.
--
-- Nuevo formato: `respuestas` JSONB con clave por pregunta, p. ej.
--   ORS: {"animo": 6, "trabajo": 8, "ansiedad": 2}
--   SRS: {"escucha": 8, "objetivos": 7, "enfoque": 9, "global": 8}
-- El catálogo de preguntas (id, tipo de escala, etiquetas) vive en el código
-- (backend/config/feedbackPreguntas.js y su gemelo en frontend), no en la BD.
--
-- Solo había respuestas de prueba: se descartan.
-- ---------------------------------------------------------------------------

DELETE FROM feedback_sesiones;

ALTER TABLE feedback_sesiones
  DROP COLUMN IF EXISTS p1,
  DROP COLUMN IF EXISTS p2,
  DROP COLUMN IF EXISTS p3,
  DROP COLUMN IF EXISTS p4,
  DROP COLUMN IF EXISTS total,
  ADD COLUMN IF NOT EXISTS respuestas jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
