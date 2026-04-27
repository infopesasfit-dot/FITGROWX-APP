CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     TEXT NOT NULL UNIQUE,
  creds_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_gym_id ON whatsapp_sessions(gym_id);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner select whatsapp_sessions') THEN
    CREATE POLICY "owner select whatsapp_sessions" ON whatsapp_sessions FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner upsert whatsapp_sessions') THEN
    CREATE POLICY "owner upsert whatsapp_sessions" ON whatsapp_sessions FOR ALL TO authenticated
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text)
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
  END IF;
END $$;
