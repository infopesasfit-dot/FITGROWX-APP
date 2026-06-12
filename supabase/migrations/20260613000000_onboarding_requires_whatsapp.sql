ALTER TABLE gym_settings
  DROP CONSTRAINT IF EXISTS onboarding_requires_whatsapp;

ALTER TABLE gym_settings
  ADD CONSTRAINT onboarding_requires_whatsapp
  CHECK (
    onboarding_completed = false
    OR NULLIF(BTRIM(whatsapp), '') IS NOT NULL
  );
