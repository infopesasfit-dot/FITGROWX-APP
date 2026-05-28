CREATE TABLE IF NOT EXISTS gym_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  promo_type TEXT NOT NULL DEFAULT 'descuento',
  discount_type TEXT NOT NULL DEFAULT 'porcentaje',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gym_promotions_type_check'
  ) THEN
    ALTER TABLE gym_promotions
      ADD CONSTRAINT gym_promotions_type_check
      CHECK (promo_type IN ('descuento', 'referido', '2x1'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gym_promotions_discount_type_check'
  ) THEN
    ALTER TABLE gym_promotions
      ADD CONSTRAINT gym_promotions_discount_type_check
      CHECK (discount_type IN ('monto', 'porcentaje'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gym_promotions_gym_id ON gym_promotions(gym_id);

ALTER TABLE gym_promotions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gym_promotions' AND policyname = 'owner select gym promotions'
  ) THEN
    CREATE POLICY "owner select gym promotions" ON gym_promotions FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gym_promotions' AND policyname = 'owner upsert gym promotions'
  ) THEN
    CREATE POLICY "owner upsert gym promotions" ON gym_promotions FOR ALL TO authenticated
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;
