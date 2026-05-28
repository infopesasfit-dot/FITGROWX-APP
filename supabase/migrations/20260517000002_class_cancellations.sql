-- Cancelaciones de instancias de clase por el gimnasio (profesor enfermo, etc.)

CREATE TABLE IF NOT EXISTS class_cancellations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      uuid        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  clase_id    uuid        NOT NULL REFERENCES gym_classes(id) ON DELETE CASCADE,
  fecha       date        NOT NULL,
  motivo      text,
  cancelled_by uuid       REFERENCES profiles(id) ON DELETE SET NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clase_id, fecha)
);

CREATE INDEX IF NOT EXISTS class_cancellations_gym_fecha
  ON class_cancellations (gym_id, fecha);
