-- ============================================================
-- FitGrowX — Trial v2: 15-day trial, plan_type, gym_status
-- ============================================================

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS trial_start_date  DATE,
  ADD COLUMN IF NOT EXISTS plan_type         TEXT,
  ADD COLUMN IF NOT EXISTS gym_status        TEXT NOT NULL DEFAULT 'trial';

-- gym_status allowed values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_gym_status_check') THEN
    ALTER TABLE gyms ADD CONSTRAINT gyms_gym_status_check
      CHECK (gym_status IN ('trial', 'active', 'trial_expired'));
  END IF;
END $$;

-- plan_type allowed values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gyms_plan_type_check') THEN
    ALTER TABLE gyms ADD CONSTRAINT gyms_plan_type_check
      CHECK (plan_type IS NULL OR plan_type IN ('gestion', 'full_marca'));
  END IF;
END $$;

-- Backfill trial_start_date from trial_expires_at (previous default was 7 days, new is 15)
UPDATE gyms
SET trial_start_date = (trial_expires_at - INTERVAL '7 days')::DATE
WHERE trial_start_date IS NULL AND trial_expires_at IS NOT NULL;

UPDATE gyms
SET trial_start_date = COALESCE(created_at::DATE, CURRENT_DATE)
WHERE trial_start_date IS NULL;

-- Extend existing trials to 15 days from their start date (migration bonus)
UPDATE gyms
SET trial_expires_at = (trial_start_date::TIMESTAMPTZ + INTERVAL '15 days')
WHERE is_subscription_active = false AND trial_expires_at > now();

-- New gyms get 15-day trial
ALTER TABLE gyms
  ALTER COLUMN trial_expires_at  SET DEFAULT now() + INTERVAL '15 days',
  ALTER COLUMN trial_start_date  SET DEFAULT CURRENT_DATE;

-- Backfill gym_status
UPDATE gyms SET gym_status =
  CASE
    WHEN is_subscription_active = true THEN 'active'
    WHEN trial_expires_at < now()      THEN 'trial_expired'
    ELSE 'trial'
  END;

-- Sync gym_status when is_subscription_active changes (trigger)
CREATE OR REPLACE FUNCTION sync_gym_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_subscription_active = true THEN
    NEW.gym_status := 'active';
  ELSIF NEW.trial_expires_at < now() THEN
    NEW.gym_status := 'trial_expired';
  ELSE
    NEW.gym_status := 'trial';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gym_status ON gyms;
CREATE TRIGGER trg_sync_gym_status
  BEFORE UPDATE ON gyms
  FOR EACH ROW EXECUTE FUNCTION sync_gym_status();
