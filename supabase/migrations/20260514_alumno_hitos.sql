CREATE TABLE IF NOT EXISTS alumno_hitos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id    UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  gym_id       UUID NOT NULL REFERENCES gyms(id)   ON DELETE CASCADE,
  hito         TEXT NOT NULL,
  reached_at   TIMESTAMPTZ DEFAULT NOW(),
  wa_sent_at   TIMESTAMPTZ,
  UNIQUE(alumno_id, hito)
);

CREATE INDEX IF NOT EXISTS idx_alumno_hitos_alumno ON alumno_hitos(alumno_id);

ALTER TABLE alumno_hitos ENABLE ROW LEVEL SECURITY;
