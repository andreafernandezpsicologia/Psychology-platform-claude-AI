-- Migración: invitación tokenizada al feedback de sesión (ORS/SRS por email)
-- ---------------------------------------------------------------------------
-- Hasta ahora el ORS/SRS solo se respondía dentro del área del paciente (sin
-- aviso), así que en la práctica casi nadie lo rellenaba. Ahora el cron envía
-- un email con un enlace tokenizado (/feedback-sesion/:token) que se responde
-- SIN login, igual que el cuestionario de cierre.
--
-- Se reutiliza la tabla feedback_sesiones que ya existe: la fila se crea al
-- ENVIAR la invitación (con token, respuestas vacías, respondido_en NULL) y se
-- completa al RESPONDER. Así todo el feedback vive en una sola tabla (donde ya
-- leen la gráfica de evolución y el export RGPD).
--
-- Idempotencia del envío: la restricción UNIQUE (sesion_id, tipo) que ya existe
-- garantiza una sola invitación por sesión+tipo (el segundo INSERT falla 23505).
-- ---------------------------------------------------------------------------

ALTER TABLE feedback_sesiones
  ADD COLUMN IF NOT EXISTS token         text,
  ADD COLUMN IF NOT EXISTS enviado_en    timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_en timestamptz;

-- El token es único cuando existe (las filas antiguas, ya respondidas, no tienen).
CREATE UNIQUE INDEX IF NOT EXISTS feedback_sesiones_token_key
  ON feedback_sesiones (token) WHERE token IS NOT NULL;

-- Backfill: todas las filas anteriores a esta migración son respuestas ya dadas
-- (se creaban solo al responder). Marcarlas como respondidas para que la gráfica
-- y el export —que ahora filtran por respondido_en— las sigan incluyendo.
UPDATE feedback_sesiones SET respondido_en = creado_en WHERE respondido_en IS NULL;

-- feedback_sesiones ya tenía GRANT; el NOTIFY hace que PostgREST vea las columnas nuevas.
NOTIFY pgrst, 'reload schema';
