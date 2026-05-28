ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS notif_cumple_year INT;

ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS cumple_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cumple_msg    TEXT;
