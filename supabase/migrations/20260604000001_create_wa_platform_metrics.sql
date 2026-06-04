CREATE TABLE IF NOT EXISTS wa_platform_metrics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id         UUID REFERENCES gyms(id) ON DELETE CASCADE,
  window_start   TIMESTAMPTZ NOT NULL,
  total_sent     INTEGER DEFAULT 0,
  total_blocked  INTEGER DEFAULT 0,
  total_failed   INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  block_ratio    NUMERIC(5,4),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wa_platform_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON wa_platform_metrics
  TO service_role
  USING (true)
  WITH CHECK (true);
