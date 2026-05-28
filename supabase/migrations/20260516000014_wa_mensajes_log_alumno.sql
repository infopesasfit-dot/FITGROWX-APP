ALTER TABLE wa_mensajes_log
  ADD COLUMN IF NOT EXISTS alumno_id   uuid REFERENCES alumnos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alumno_name text;
