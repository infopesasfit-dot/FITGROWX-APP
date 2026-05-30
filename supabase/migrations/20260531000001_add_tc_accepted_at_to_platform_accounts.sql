ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMPTZ;
