ALTER TABLE wa_mensajes_log
  ADD COLUMN IF NOT EXISTS status            TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms        INTEGER,
  ADD COLUMN IF NOT EXISTS motor_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS motor_error       TEXT;
