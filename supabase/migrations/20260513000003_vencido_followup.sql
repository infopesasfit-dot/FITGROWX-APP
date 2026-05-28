-- Post-expiry follow-up tracking for alumnos
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS notif_vencido_d3_para DATE,
  ADD COLUMN IF NOT EXISTS notif_vencido_d7_para DATE;
