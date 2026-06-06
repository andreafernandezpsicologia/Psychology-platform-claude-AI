-- Añadir columnas 2FA a la tabla users
-- Ejecutar en Supabase: SQL Editor → pegar y ejecutar

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para consultas rápidas (opcional, tabla pequeña)
-- CREATE INDEX IF NOT EXISTS users_totp_enabled_idx ON users(totp_enabled) WHERE totp_enabled = TRUE;

COMMENT ON COLUMN users.totp_secret  IS 'Secreto TOTP para autenticación en dos factores (solo admin)';
COMMENT ON COLUMN users.totp_enabled IS 'Indica si el 2FA está activo para este usuario';
