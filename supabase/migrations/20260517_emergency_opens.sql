-- Aperturas de emergencia del molinete iniciadas desde el dashboard

CREATE TABLE IF NOT EXISTS emergency_opens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     uuid        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  created_by uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,           -- null = pendiente, set = consumido por el hardware
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '45 seconds'
);

-- El hardware solo necesita buscar tokens pendientes recientes
CREATE INDEX IF NOT EXISTS emergency_opens_gym_pending
  ON emergency_opens (gym_id, expires_at)
  WHERE consumed_at IS NULL;
