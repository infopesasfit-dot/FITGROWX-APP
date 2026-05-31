CREATE TABLE IF NOT EXISTS wa_contact_metrics (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  alumno_id       UUID        NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  blocked_count   INTEGER     DEFAULT 0,
  last_blocked_at TIMESTAMPTZ,
  cooldown_until  TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  failed_count    INTEGER     DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_contact_metrics_cooldown
  ON wa_contact_metrics(cooldown_until)
  WHERE cooldown_until IS NOT NULL;
