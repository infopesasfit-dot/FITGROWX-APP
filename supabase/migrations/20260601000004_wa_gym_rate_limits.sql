CREATE TABLE IF NOT EXISTS wa_gym_rate_limits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID        NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  window_start  TIMESTAMPTZ NOT NULL,
  message_count INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gym_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_wa_gym_rate_limits_window
  ON wa_gym_rate_limits(gym_id, window_start DESC);

CREATE OR REPLACE FUNCTION check_gym_wa_rate_limit(p_gym_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE(allowed BOOLEAN, count_used INTEGER, limit_val INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count        INTEGER;
BEGIN
  v_window_start := DATE_TRUNC('minute', NOW());

  INSERT INTO wa_gym_rate_limits (gym_id, window_start, message_count)
  VALUES (p_gym_id, v_window_start, 0)
  ON CONFLICT (gym_id, window_start) DO UPDATE
    SET message_count = wa_gym_rate_limits.message_count + 1;

  SELECT message_count INTO v_count
  FROM wa_gym_rate_limits
  WHERE gym_id = p_gym_id AND window_start = v_window_start;

  RETURN QUERY SELECT (v_count <= p_limit), v_count, p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION check_gym_wa_rate_limit TO authenticated;
