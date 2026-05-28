CREATE TABLE IF NOT EXISTS guest_passes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  alumno_id   UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  code        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | claimed | used | expired
  lead_name   TEXT,
  lead_phone  TEXT,
  claimed_at  TIMESTAMPTZ,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_passes_token  ON guest_passes(token);
CREATE INDEX IF NOT EXISTS idx_guest_passes_gym    ON guest_passes(gym_id);
CREATE INDEX IF NOT EXISTS idx_guest_passes_alumno ON guest_passes(alumno_id);

ALTER TABLE guest_passes ENABLE ROW LEVEL SECURITY;
