ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS owner_alert_sent_at TIMESTAMPTZ;
