CREATE TABLE IF NOT EXISTS cron_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name   text        NOT NULL,
  ran_at      timestamptz NOT NULL DEFAULT now(),
  status      text        NOT NULL CHECK (status IN ('ok', 'error')),
  duration_ms integer,
  summary     text,
  counts      jsonb
);

CREATE INDEX IF NOT EXISTS cron_runs_name_ran_at ON cron_runs (cron_name, ran_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Solo service-role puede escribir; ningún usuario autenticado puede leer/escribir directamente.
-- El dashboard lo lee vía API con service-role.
