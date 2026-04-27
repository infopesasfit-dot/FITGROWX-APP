-- FitGrowX — Tracking de notificaciones de trial, cancelación y vencimiento de alumnos
-- Permite reintentar notificaciones WA fallidas en lugar de perderlas

-- ── gyms: tracking de notificaciones propias ──────────────────────────────────
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS trial_notif_d13_sent_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_notif_d15_sent_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_notif_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at              TIMESTAMPTZ;

-- ── gym_settings: configuración de recordatorio de vencimiento de alumnos ────
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS vencimiento_activo  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vencimiento_dias    INT     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS vencimiento_msg     TEXT;

-- ── alumnos: última fecha de vencimiento para la que se envió recordatorio ───
-- Si next_expiration_date != notif_vencimiento_para → recordatorio pendiente para este ciclo
ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS notif_vencimiento_para DATE;
