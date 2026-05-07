-- ══════════════════════════════════════════════════════════════════
-- Bundle migraciones pendientes — 2026-05-07
-- Incluye: contactos_followup, diadia_vuelvencasa,
--          reservations_unique, platform_feedback
-- ══════════════════════════════════════════════════════════════════

-- ── 1. contactos_followup ─────────────────────────────────────────
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS contactos_step INT NOT NULL DEFAULT 0;

ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS contactos_activo        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contactos_msg_0         TEXT,
  ADD COLUMN IF NOT EXISTS contactos_msg_1         TEXT;

-- ── 2. diadia_vuelvencasa ─────────────────────────────────────────
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS diadia_presente_msg     TEXT,
  ADD COLUMN IF NOT EXISTS diadia_post_msg         TEXT,
  ADD COLUMN IF NOT EXISTS diadia_recordatorio_msg TEXT,
  ADD COLUMN IF NOT EXISTS vuelvencasa_activo      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vuelvencasa_msg         TEXT;

-- ── 3. reservations_unique ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'class_reservations_class_phone_unique'
  ) THEN
    ALTER TABLE class_reservations
      ADD CONSTRAINT class_reservations_class_phone_unique
      UNIQUE (class_id, lead_phone);
  END IF;
END$$;

-- ── 4. platform_feedback (tabla nunca creada) ─────────────────────
CREATE TABLE IF NOT EXISTS platform_feedback (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID        NOT NULL,
  gym_name   TEXT,
  email      TEXT,
  message    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_feedback_gym_id    ON platform_feedback(gym_id);
CREATE INDEX IF NOT EXISTS idx_platform_feedback_created   ON platform_feedback(created_at DESC);

ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe (usa admin client), platform_owner lee
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='platform_feedback' AND policyname='service_all_feedback'
  ) THEN
    CREATE POLICY "service_all_feedback" ON platform_feedback FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='platform_feedback' AND policyname='platform_owner_select_feedback'
  ) THEN
    CREATE POLICY "platform_owner_select_feedback" ON platform_feedback FOR SELECT TO authenticated
      USING (is_platform_owner(auth.uid()));
  END IF;
END $$;
