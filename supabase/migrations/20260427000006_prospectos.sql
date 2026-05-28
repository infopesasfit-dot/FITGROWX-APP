CREATE TABLE IF NOT EXISTS prospectos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  status     TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'contactado', 'descartado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, email)
);

CREATE INDEX IF NOT EXISTS idx_prospectos_gym_id ON prospectos(gym_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_status ON prospectos(status);

ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='public insert prospectos') THEN
    CREATE POLICY "public insert prospectos" ON prospectos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner select prospectos') THEN
    CREATE POLICY "owner select prospectos" ON prospectos FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner update prospectos') THEN
    CREATE POLICY "owner update prospectos" ON prospectos FOR UPDATE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner delete prospectos') THEN
    CREATE POLICY "owner delete prospectos" ON prospectos FOR DELETE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;
