-- clase_gratis_status tracks where the prospecto is in the post-class funnel
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS clase_gratis_status TEXT
    DEFAULT 'registrado'
    CHECK (clase_gratis_status IN ('registrado', 'asistio', 'no_show', 'convertido', 'perdido'));

-- message template for no-show follow-up
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS clase_gratis_msg_noshow TEXT;

-- backfill: existing records with a clase_gratis_date stay as 'registrado'
-- (followup_step > 0 means messages were already sent → treat as 'asistio' so cron doesn't restart them)
UPDATE prospectos
  SET clase_gratis_status = 'asistio'
  WHERE clase_gratis_date IS NOT NULL
    AND followup_step > 0
    AND clase_gratis_status = 'registrado';
