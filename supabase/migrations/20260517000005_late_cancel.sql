-- Ventana de cancelación y estado de cancelación tardía

-- 1. Ventana configurable por gym (null = sin restricción)
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS cancel_window_hours integer DEFAULT NULL;

-- 2. Nuevo estado para cancelaciones fuera de ventana
ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('confirmada', 'cancelada', 'cancelada_tarde'));

-- 3. Índice para el conteo semanal de cuota (incluye cancelada_tarde)
CREATE INDEX IF NOT EXISTS reservas_alumno_semana_cuota
  ON reservas (alumno_id, gym_id, fecha)
  WHERE estado IN ('confirmada', 'cancelada_tarde');
