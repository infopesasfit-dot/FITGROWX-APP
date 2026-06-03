ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_gym_settings_api_key ON gym_settings(api_key);
