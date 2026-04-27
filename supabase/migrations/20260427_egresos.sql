CREATE TABLE IF NOT EXISTS egresos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL,
  titulo     TEXT NOT NULL,
  monto      NUMERIC(12,2) NOT NULL,
  categoria  TEXT NOT NULL DEFAULT 'Otros',
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egresos_gym_id ON egresos(gym_id);
CREATE INDEX IF NOT EXISTS idx_egresos_fecha  ON egresos(fecha);

ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner select egresos') THEN
    CREATE POLICY "owner select egresos" ON egresos FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner insert egresos') THEN
    CREATE POLICY "owner insert egresos" ON egresos FOR INSERT
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner update egresos') THEN
    CREATE POLICY "owner update egresos" ON egresos FOR UPDATE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner delete egresos') THEN
    CREATE POLICY "owner delete egresos" ON egresos FOR DELETE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;
