-- Dedup column: prevents the vencimientos cron from sending the owner
-- the "14+ day absent students" WA notification more than once per day.
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS notif_inasistencia_owner_sent_at date;
