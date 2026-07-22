-- Migración: cuestionario de fin de terapia (feedback_final)
-- ---------------------------------------------------------------------------
-- Andrea lo envía MANUALMENTE al cerrar un proceso (nunca automático). Al
-- paciente le llega un email con un enlace tokenizado que responde SIN login
-- (puede que ya no entre a la app). La respuesta llega identificada (con
-- nombre): a esas alturas el anonimato ya no aporta y el contexto sí.
--
-- 2 escalas 0-10 + 3 textos libres. Dato ligado a paciente (Art. 9 RGPD):
-- solo admin, incluido en el export RGPD (se añade en pacientes.js).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS feedback_final (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  enviado_en timestamptz NOT NULL DEFAULT now(),
  respondido_en timestamptz,
  satisfaccion smallint CHECK (satisfaccion BETWEEN 0 AND 10),
  recomendaria smallint CHECK (recomendaria BETWEEN 0 AND 10),
  que_ayudo text,
  que_mejorar text,
  como_te_vas text
);

-- Sin GRANT, el backend (service_role) recibe "permission denied for table"
-- en tablas creadas vía Management API.
GRANT ALL PRIVILEGES ON TABLE public.feedback_final TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
