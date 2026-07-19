-- Migración: pago fraccionado de bonos (1 pago o 2 cuotas)
-- ---------------------------------------------------------------------------
-- Solo aplica a BONOS (packs), no a sesiones sueltas. Al pagar, el paciente
-- elige pago único o 2 cuotas (mitad ahora, mitad antes de fin del mes
-- siguiente). La 2ª cuota se cobra por enlace + recordatorio, nunca cargo
-- automático. Reutiliza packs.estado_pago='pago_parcial' (ya existía para el
-- marcado manual) para "cuota 1 pagada, cuota 2 pendiente".
-- ---------------------------------------------------------------------------

ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS num_cuotas smallint NOT NULL DEFAULT 1 CHECK (num_cuotas IN (1, 2));

CREATE TABLE IF NOT EXISTS cuotas_pack (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  numero smallint NOT NULL CHECK (numero IN (1, 2)),
  importe_cents integer NOT NULL,
  fecha_limite date,              -- NULL en la cuota 1 (se paga al momento)
  estado_pago text NOT NULL DEFAULT 'no_pagado' CHECK (estado_pago IN ('no_pagado', 'pagado')),
  fecha_pago timestamptz,
  recordatorio_enviado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, numero)
);

-- El ledger de pagos también puede venir de una cuota (no solo de pack/sesión entero).
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS cuota_id uuid REFERENCES cuotas_pack(id) ON DELETE SET NULL;

ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_tipo_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_tipo_check CHECK (tipo IN ('pack', 'sesion', 'cuota'));

-- Lección de la migración anterior: sin GRANT, el backend (service_role) recibe
-- "permission denied for table" en tablas creadas vía Management API.
GRANT ALL PRIVILEGES ON TABLE public.cuotas_pack TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
