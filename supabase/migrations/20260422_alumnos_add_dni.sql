ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS dni TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alumnos_gym_dni
  ON alumnos(gym_id, dni)
  WHERE dni IS NOT NULL;
