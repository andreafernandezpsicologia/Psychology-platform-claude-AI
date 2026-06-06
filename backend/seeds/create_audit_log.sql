-- Tabla de registro de auditoría (RGPD Art. 30 — Registro de actividades de tratamiento)
-- Ejecutar en Supabase: SQL Editor → pegar y ejecutar

CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role    TEXT,
  action       TEXT NOT NULL,        -- 'login', 'view_patient', 'update_patient', 'delete_patient', 'view_sessions', etc.
  resource     TEXT,                 -- 'patients', 'sessions', 'packs', 'contracts', 'documents'
  resource_id  TEXT,                 -- ID del recurso afectado
  ip_address   TEXT,
  user_agent   TEXT,
  details      JSONB                 -- Información adicional (sin datos sensibles)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx    ON audit_log(action);

-- Solo el service role puede insertar (el backend usa service role)
-- Los usuarios normales no pueden leer ni escribir directamente
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo service role puede acceder al audit log"
  ON audit_log
  FOR ALL
  USING (false);  -- bloquear acceso directo; solo el backend (service role) puede operar

-- Comentario descriptivo
COMMENT ON TABLE audit_log IS 'Registro de actividades de tratamiento de datos personales — RGPD Art. 30';
