-- Índices para reducir latencia del dashboard (de ~3400ms a <500ms esperado)

-- alumnos: casi todas las queries filtran por gym_id + deleted_at o status
CREATE INDEX IF NOT EXISTS alumnos_gym_deleted
  ON alumnos(gym_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS alumnos_gym_status_deleted
  ON alumnos(gym_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS alumnos_gym_expiry_activo
  ON alumnos(gym_id, next_expiration_date)
  WHERE status = 'activo' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS alumnos_gym_created_deleted
  ON alumnos(gym_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- asistencias: query por gym + rango de fechas
CREATE INDEX IF NOT EXISTS asistencias_gym_fecha
  ON asistencias(gym_id, fecha DESC);

-- pagos: query por gym + rango de fechas
CREATE INDEX IF NOT EXISTS pagos_gym_date
  ON pagos(gym_id, date DESC);

-- egresos: query por gym + rango de fechas
CREATE INDEX IF NOT EXISTS egresos_gym_fecha
  ON egresos(gym_id, fecha DESC);

-- prospectos: count por status + query por rango de created_at
CREATE INDEX IF NOT EXISTS prospectos_gym_status
  ON prospectos(gym_id, status);

CREATE INDEX IF NOT EXISTS prospectos_gym_created
  ON prospectos(gym_id, created_at DESC);

-- reservas: query por gym + rango de fechas
CREATE INDEX IF NOT EXISTS reservas_gym_fecha
  ON reservas(gym_id, fecha DESC);
