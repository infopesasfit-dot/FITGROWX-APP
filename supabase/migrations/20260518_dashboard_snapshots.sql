-- Pre-computed dashboard payload per gym per calendar month.
-- The dashboard API writes here after a full computation and reads from here
-- on subsequent loads (fast path: 2 live queries instead of 12).
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  gym_id      UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  month_key   TEXT NOT NULL,          -- 'YYYY-MM'
  payload     JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (gym_id, month_key)
);

CREATE INDEX IF NOT EXISTS dashboard_snapshots_gym_month
  ON dashboard_snapshots (gym_id, month_key DESC);
