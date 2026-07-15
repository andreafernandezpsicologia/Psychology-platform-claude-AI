-- Migración: snapshot de evidencia de consentimiento (RGPD Art. 7)
-- ---------------------------------------------------------------------------
-- Problema: aceptaciones_documentos solo guardaba documento_id, y el seed del
-- consentimiento reescribe contenido/version EN LA MISMA fila de
-- documentos_legales. Resultado: la "prueba de aceptación" mostraba el texto
-- actual, no el que el paciente vio al aceptar.
--
-- Arreglo: columnas de snapshot rellenadas por POST /api/documentos/aceptar en
-- el momento de aceptar. Aditiva y no destructiva (columnas NULL en filas
-- antiguas). Los endpoints de evidencia prefieren el snapshot cuando existe.
--
-- Backfill incluido: solo la aceptación DA del 13-jul-2026, porque es
-- verificable (el texto DA no ha cambiado desde el 09-jul-2026 y coincide
-- byte a byte con el fichero fuente). Las dos aceptaciones ES de junio-2026
-- se dejan sin snapshot A PROPÓSITO: el texto que vieron fue reescrito en
-- julio y no es reconstruible con certeza; su evidencia es la firma en papel.
--
-- Ejecutar UNA VEZ via API de Supabase (ver CLAUDE.md) o SQL Editor.
-- ---------------------------------------------------------------------------

ALTER TABLE aceptaciones_documentos
  ADD COLUMN IF NOT EXISTS titulo_aceptado text,
  ADD COLUMN IF NOT EXISTS version_aceptada integer,
  ADD COLUMN IF NOT EXISTS contenido_aceptado text;

COMMENT ON COLUMN aceptaciones_documentos.contenido_aceptado IS
  'Snapshot RGPD Art. 7: texto exacto que el paciente vio al aceptar. NULL en aceptaciones anteriores a jul-2026 (su evidencia es la firma en papel).';

-- Backfill verificable: aceptación danesa del 13-jul-2026 (el contenido del
-- documento no ha cambiado desde antes de esa fecha).
UPDATE aceptaciones_documentos a
SET titulo_aceptado    = d.titulo,
    version_aceptada   = d.version,
    contenido_aceptado = d.contenido
FROM documentos_legales d
WHERE d.id = a.documento_id
  AND d.tipo = 'consentimiento_informado'
  AND d.idioma = 'da'
  AND a.fecha_aceptacion >= '2026-07-09'
  AND a.contenido_aceptado IS NULL;
