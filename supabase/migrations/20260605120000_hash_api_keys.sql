CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
UPDATE gym_settings SET api_key_hash = encode(extensions.digest(api_key, 'sha256'), 'hex') WHERE api_key IS NOT NULL;
ALTER TABLE gym_settings DROP COLUMN api_key;
ALTER TABLE gym_settings RENAME COLUMN api_key_hash TO api_key;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS api_key_last_used_at TIMESTAMPTZ;
