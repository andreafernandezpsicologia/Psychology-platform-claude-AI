-- Migración Fase 1: base de pagos de terapia
-- ---------------------------------------------------------------------------
-- Hasta ahora el pago de terapia se registraba SOLO a nivel de pack
-- (packs.estado_pago, marcado a mano). Las sesiones sueltas (pack_id NULL) no
-- tenían forma de registrar si estaban pagadas. Esta migración añade:
--   - estado de pago + precio a nivel de sesión suelta,
--   - precio + fecha de pago a nivel de pack,
--   - tabla `tarifas` (precios configurables sin redeploy),
--   - tabla `pagos` (registro; en Fase 2 recibe los pagos de Stripe),
--   - flag `pago_online_habilitado` por paciente (opt-in, se usa en Fase 2).
--
-- Aditiva y no destructiva (columnas NULL / DEFAULT en filas existentes; el
-- frontend actual las ignora). Ejecutar UNA VEZ vía API de Supabase (ver CLAUDE.md).
-- ---------------------------------------------------------------------------

-- Opt-in de cobro online por paciente (Andrea decide quién paga por la app).
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS pago_online_habilitado boolean NOT NULL DEFAULT false;

-- Estado de pago a nivel de sesión suelta. NULL = la sesión va con un pack, no aplica.
ALTER TABLE sesiones
  ADD COLUMN IF NOT EXISTS estado_pago text CHECK (estado_pago IN ('no_pagado','pagado')),
  ADD COLUMN IF NOT EXISTS precio_cents integer,
  ADD COLUMN IF NOT EXISTS fecha_pago timestamptz;

COMMENT ON COLUMN sesiones.estado_pago IS
  'Pago de la sesión SUELTA (pack_id NULL). NULL cuando la sesión pertenece a un pack.';

-- Precio pagado e importe del pack (para métricas de ingresos e histórico).
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS precio_cents integer,
  ADD COLUMN IF NOT EXISTS fecha_pago timestamptz;

-- Tarifas configurables: Andrea las edita sin redeploy. El precio de cada
-- pack/sesión se prefija desde aquí pero es editable (precios especiales).
CREATE TABLE IF NOT EXISTS tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  concepto text NOT NULL,
  precio_cents integer NOT NULL,
  num_sesiones integer,          -- NULL = sesión suelta
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Registro de pagos. En Fase 2 el webhook de Stripe inserta aquí de forma
-- idempotente (stripe_session_id UNIQUE). paciente_id ON DELETE SET NULL: el
-- borrado de un paciente no rompe la contabilidad pero elimina el vínculo.
CREATE TABLE IF NOT EXISTS pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text UNIQUE,
  paciente_id uuid REFERENCES pacientes(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('pack','sesion')),
  pack_id uuid REFERENCES packs(id) ON DELETE SET NULL,
  sesion_id uuid REFERENCES sesiones(id) ON DELETE SET NULL,
  importe_cents integer,
  moneda text NOT NULL DEFAULT 'eur',
  metodo_pago text,              -- card | bizum (lo rellena Stripe en Fase 2)
  origen text NOT NULL DEFAULT 'manual',  -- manual | stripe
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Permisos: Supabase asigna estos GRANT por defecto a las tablas creadas desde
-- el dashboard, pero NO a las creadas vía Management API. Sin ellos, el backend
-- (service_role) recibe "permission denied for table" al insertar/leer.
GRANT ALL PRIVILEGES ON TABLE public.tarifas TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.pagos   TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- Seed de tarifas con los precios generales reales de Studio Renacer.
-- Los precios especiales por paciente se fijan editando el precio de su pack/sesión.
INSERT INTO tarifas (codigo, concepto, precio_cents, num_sesiones) VALUES
  ('sesion_individual', 'Sesión individual (suelta)',  7500, NULL),
  ('sesion_evaluacion', 'Sesión de evaluación',       15000, NULL),
  ('pack_5',            'Bono de 5 sesiones',         35000, 5),
  ('pack_10',           'Bono de 10 sesiones',        60000, 10)
ON CONFLICT (codigo) DO NOTHING;
