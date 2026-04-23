-- ============================================================
-- FitGrowX SaaS funnel
-- lead -> registro -> trial -> conversion
-- ============================================================

-- ── platform_leads status refined ────────────────────────────
ALTER TABLE platform_leads
  ALTER COLUMN status SET DEFAULT 'new';

UPDATE platform_leads
SET status = 'registered'
WHERE status = 'won';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'platform_leads'
      AND constraint_name = 'platform_leads_status_check'
  ) THEN
    ALTER TABLE platform_leads DROP CONSTRAINT platform_leads_status_check;
  END IF;
END $$;

ALTER TABLE platform_leads
  ADD CONSTRAINT platform_leads_status_check
  CHECK (status IN ('new', 'contacted', 'qualified', 'registered', 'lost'));

-- ── platform_accounts lifecycle for trial and conversion ─────
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS trial_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_score INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE platform_accounts
SET status = CASE
  WHEN status = 'lead' THEN 'trial_setup'
  WHEN status = 'trial' THEN 'trial_active'
  WHEN status = 'active' THEN 'converted'
  WHEN status = 'paused' THEN 'trial_risk'
  ELSE status
END;

UPDATE platform_accounts
SET
  trial_starts_at = COALESCE(trial_starts_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '15 days')
WHERE status IN ('trial_setup', 'trial_active', 'trial_risk');

UPDATE platform_accounts
SET converted_at = COALESCE(converted_at, updated_at)
WHERE status = 'converted';

ALTER TABLE platform_accounts
  ALTER COLUMN status SET DEFAULT 'trial_setup';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'platform_accounts'
      AND constraint_name = 'platform_accounts_status_check'
  ) THEN
    ALTER TABLE platform_accounts DROP CONSTRAINT platform_accounts_status_check;
  END IF;
END $$;

ALTER TABLE platform_accounts
  ADD CONSTRAINT platform_accounts_status_check
  CHECK (status IN ('trial_setup', 'trial_active', 'trial_risk', 'converted', 'churned'));

CREATE INDEX IF NOT EXISTS platform_accounts_trial_end_idx ON platform_accounts(trial_ends_at);
