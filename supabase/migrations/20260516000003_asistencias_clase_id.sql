ALTER TABLE asistencias
  ADD COLUMN IF NOT EXISTS clase_id uuid REFERENCES gym_classes(id) ON DELETE SET NULL;
