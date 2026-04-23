-- ============================================================
-- FitGrowX — Trial & Subscription fields on gyms
-- ============================================================

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS trial_expires_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_subscription_active BOOLEAN NOT NULL DEFAULT false;

-- Gyms existentes: 7 días desde su creación (o desde ahora si no tienen created_at)
UPDATE gyms
SET trial_expires_at = COALESCE(created_at, now()) + INTERVAL '7 days'
WHERE trial_expires_at IS NULL;

-- Default para gyms nuevos: 7 días desde que se crea el registro
ALTER TABLE gyms
  ALTER COLUMN trial_expires_at SET DEFAULT now() + INTERVAL '7 days';

-- RLS: gyms can read their own row (needed by proxy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gyms' AND policyname = 'gym reads own row'
  ) THEN
    CREATE POLICY "gym reads own row"
    ON gyms FOR SELECT
    USING (id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;
