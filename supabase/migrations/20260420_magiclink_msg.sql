ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS magiclink_msg TEXT,
  ADD COLUMN IF NOT EXISTS gym_name      TEXT;
