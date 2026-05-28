ALTER TABLE gym_settings DROP COLUMN IF EXISTS mp_link;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS mp_access_token TEXT;
