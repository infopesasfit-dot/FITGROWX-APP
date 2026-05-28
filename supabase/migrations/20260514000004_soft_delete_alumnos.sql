-- Soft delete para alumnos: deleted_at = NULL = activo, NOT NULL = borrado lógico
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_alumnos_deleted_at ON alumnos(deleted_at) WHERE deleted_at IS NULL;
