-- Migración: feedback clínico ORS/SRS por sesión
-- ---------------------------------------------------------------------------
-- ORS (al empezar, "¿cómo estás esta semana?") y SRS (al terminar, "¿cómo ha
-- ido la sesión?"): 4 deslizadores 0-10 cada uno, digitalizando lo que Andrea
-- ya pregunta de palabra. Dato de salud (Art. 9 RGPD): ligado a paciente y
-- sesión, solo visible para admin, entra en el export RGPD.
--
-- Mapeo de p1..p4 (documentado aquí, no hay columnas por nombre a propósito
-- para no atarse a la terminología exacta si cambia el cuestionario):
--   ORS: p1=individual, p2=interpersonal, p3=social, p4=general
--   SRS: p1=relación,   p2=objetivos,      p3=enfoque, p4=global
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback_sesiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  sesion_id uuid NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ors', 'srs')),
  p1 numeric(3,1) NOT NULL CHECK (p1 BETWEEN 0 AND 10),
  p2 numeric(3,1) NOT NULL CHECK (p2 BETWEEN 0 AND 10),
  p3 numeric(3,1) NOT NULL CHECK (p3 BETWEEN 0 AND 10),
  p4 numeric(3,1) NOT NULL CHECK (p4 BETWEEN 0 AND 10),
  total numeric(4,1) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sesion_id, tipo)
);

-- Lección de migraciones anteriores: sin GRANT, el backend (service_role)
-- recibe "permission denied for table" en tablas creadas vía Management API.
GRANT ALL PRIVILEGES ON TABLE public.feedback_sesiones TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
