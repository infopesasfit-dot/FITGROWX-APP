-- Día a Día message templates
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS diadia_presente_msg TEXT,
  ADD COLUMN IF NOT EXISTS diadia_post_msg TEXT,
  ADD COLUMN IF NOT EXISTS diadia_recordatorio_msg TEXT,
  ADD COLUMN IF NOT EXISTS diadia_logro_msg TEXT;

-- Vuelven a Casa step-2 message template (30 days)
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS inactividad_msg_3 TEXT;

-- Tracking column for step-2 inactividad notification on alumnos
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS ultima_notif_inactividad_3 TIMESTAMPTZ;
