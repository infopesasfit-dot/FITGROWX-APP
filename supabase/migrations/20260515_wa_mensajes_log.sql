CREATE TABLE IF NOT EXISTS wa_mensajes_log (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id   uuid NOT NULL,
  tipo     text NOT NULL,
  sent_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS wa_mensajes_log_gym_sent
  ON wa_mensajes_log(gym_id, sent_at DESC);
