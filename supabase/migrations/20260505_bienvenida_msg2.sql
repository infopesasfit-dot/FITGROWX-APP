-- Second welcome message (sent ~3 min after the magic link)
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS bienvenida_app_msg TEXT;
