-- Tracking column for day-0 expiry notification (avoids sending pre-expiry reminder on exact expiry day)
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS notif_vence_hoy_para DATE;
