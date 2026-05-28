-- prospectos: track free class date and follow-up progress
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS clase_gratis_date DATE,
  ADD COLUMN IF NOT EXISTS followup_step     INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_prospectos_clase_gratis ON prospectos(clase_gratis_date) WHERE clase_gratis_date IS NOT NULL;

-- gym_settings: clase gratis automation config
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS clase_gratis_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clase_gratis_msg_0  TEXT,
  ADD COLUMN IF NOT EXISTS clase_gratis_msg_2  TEXT,
  ADD COLUMN IF NOT EXISTS clase_gratis_msg_5  TEXT;
