-- Migración: estado 'no_show' (el paciente no asistió) en sesiones
-- ---------------------------------------------------------------------------
-- Hasta ahora una sesión a la que el paciente no venía se marcaba como
-- 'cancelada_con_cargo' o 'completada', y no había forma de contar las faltas.
-- El panel de Inicio (Fase 6) muestra un KPI de no-shows del mes, así que se
-- añade un estado propio. Como 'cancelada_con_cargo', consume la sesión del
-- pack (el hueco se reservó y no se avisó) — ver debeDescontar en sesiones.js.
-- ---------------------------------------------------------------------------

ALTER TABLE sesiones DROP CONSTRAINT IF EXISTS sesiones_estado_check;
ALTER TABLE sesiones ADD CONSTRAINT sesiones_estado_check
  CHECK (estado = ANY (ARRAY[
    'programada'::text, 'completada'::text, 'cancelada'::text,
    'cancelada_con_cargo'::text, 'solicitada'::text, 'no_show'::text
  ]));

NOTIFY pgrst, 'reload schema';
