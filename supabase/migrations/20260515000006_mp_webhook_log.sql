CREATE TABLE IF NOT EXISTS mp_webhook_log (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source         text NOT NULL,          -- 'gym' | 'platform'
  gym_id         text,
  payment_id     text,
  event_type     text,                   -- 'payment' | 'preapproval'
  status         text NOT NULL,          -- 'received' | 'processed' | 'duplicate' | 'error' | 'ignored'
  error_msg      text,
  amount         numeric,
  alumno_id      text,
  received_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS mp_webhook_log_gym_received  ON mp_webhook_log(gym_id, received_at DESC);
CREATE INDEX IF NOT EXISTS mp_webhook_log_payment_id    ON mp_webhook_log(payment_id);
CREATE INDEX IF NOT EXISTS mp_webhook_log_status        ON mp_webhook_log(status, received_at DESC);
