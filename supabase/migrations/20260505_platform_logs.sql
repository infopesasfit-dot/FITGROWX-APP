CREATE TABLE IF NOT EXISTS platform_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT        NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  route       TEXT,
  message     TEXT        NOT NULL,
  meta        JSONB,
  duration_ms INT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_logs_level_created ON platform_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_logs_created       ON platform_logs(created_at DESC);

ALTER TABLE platform_logs ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede escribir/leer (logger usa admin client)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='platform_logs' AND policyname='service_role_all'
  ) THEN
    CREATE POLICY "service_role_all" ON platform_logs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
