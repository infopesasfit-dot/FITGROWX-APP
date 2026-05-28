-- ── Fraud detection hardening ───────────────────────────────────────────────

-- 1. Rastrear cambios de status en alumnos
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_alumno_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alumno_status_updated ON alumnos;
CREATE TRIGGER trg_alumno_status_updated
  BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION set_alumno_status_updated_at();

-- 2. Contar cambios de DNI por alumno
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS dni_updated_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION inc_alumno_dni_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.dni IS DISTINCT FROM NEW.dni AND NEW.dni IS NOT NULL THEN
    NEW.dni_updated_count = COALESCE(OLD.dni_updated_count, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alumno_dni_count ON alumnos;
CREATE TRIGGER trg_alumno_dni_count
  BEFORE UPDATE ON alumnos
  FOR EACH ROW EXECUTE FUNCTION inc_alumno_dni_count();

-- 3. Evitar duplicados exactos de check-in (mismo alumno, mismo día, misma hora)
--    El UNIQUE(alumno_id, fecha) fue eliminado para permitir doble turno.
--    Reemplazamos con un índice sobre (alumno_id, fecha, hora) que bloquea
--    inserciones idénticas pero permite turnos distintos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_asist_alumno_fecha_hora
  ON asistencias(alumno_id, fecha, hora);
