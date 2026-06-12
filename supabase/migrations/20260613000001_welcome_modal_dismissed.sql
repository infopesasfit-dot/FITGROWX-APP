ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS welcome_modal_dismissed BOOLEAN NOT NULL DEFAULT false;
