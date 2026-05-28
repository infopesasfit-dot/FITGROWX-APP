-- gym_settings: WhatsApp session state
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS wa_status   TEXT,
  ADD COLUMN IF NOT EXISTS wa_phone    TEXT,
  ADD COLUMN IF NOT EXISTS wa_battery  INT,
  ADD COLUMN IF NOT EXISTS wa_plugged  BOOLEAN,
  ADD COLUMN IF NOT EXISTS wa_signal   INT;

-- gym_settings: onboarding flag
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- gyms: MercadoPago preapproval subscription ID
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;
