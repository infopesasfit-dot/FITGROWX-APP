CREATE TABLE IF NOT EXISTS wa_motor_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT        NOT NULL,
  session    TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  reason     TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_motor_events_created ON wa_motor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_motor_events_type    ON wa_motor_events(event_type);
CREATE INDEX IF NOT EXISTS idx_wa_motor_events_phone   ON wa_motor_events(phone);
