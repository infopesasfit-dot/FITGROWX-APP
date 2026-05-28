-- ============================================================
-- FitGrowX — gym_settings + leads
-- Multi-tenant: gym_id = auth.users.id (sin tabla gyms intermedia)
-- ============================================================

-- ── gym_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_settings (
  gym_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_name          TEXT,
  owner_name        TEXT,
  whatsapp          TEXT,
  email             TEXT,
  whatsapp_connected BOOLEAN NOT NULL DEFAULT false,
  accent_color      TEXT    NOT NULL DEFAULT '#F97316',
  slug              TEXT    UNIQUE,
  logo_url          TEXT,
  landing_title     TEXT,
  landing_desc      TEXT,
  cobro_alias       TEXT,
  welcome_msg       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at automático
CREATE OR REPLACE FUNCTION set_gym_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gym_settings_updated_at ON gym_settings;
CREATE TRIGGER gym_settings_updated_at
  BEFORE UPDATE ON gym_settings
  FOR EACH ROW EXECUTE FUNCTION set_gym_settings_updated_at();

-- RLS
ALTER TABLE gym_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_settings' AND policyname='owner select') THEN
    CREATE POLICY "owner select" ON gym_settings FOR SELECT USING (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_settings' AND policyname='owner insert') THEN
    CREATE POLICY "owner insert" ON gym_settings FOR INSERT WITH CHECK (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_settings' AND policyname='owner update') THEN
    CREATE POLICY "owner update" ON gym_settings FOR UPDATE USING (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_settings' AND policyname='owner delete') THEN
    CREATE POLICY "owner delete" ON gym_settings FOR DELETE USING (gym_id = auth.uid());
  END IF;
END $$;

-- ── leads ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID        NOT NULL REFERENCES gym_settings(gym_id) ON DELETE CASCADE,
  full_name     TEXT,
  phone_number  TEXT,
  status        TEXT        NOT NULL DEFAULT 'pendiente',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_gym_id_idx ON leads (gym_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='owner select') THEN
    CREATE POLICY "owner select" ON leads FOR SELECT USING (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='owner insert') THEN
    CREATE POLICY "owner insert" ON leads FOR INSERT WITH CHECK (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='owner update') THEN
    CREATE POLICY "owner update" ON leads FOR UPDATE USING (gym_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='leads' AND policyname='owner delete') THEN
    CREATE POLICY "owner delete" ON leads FOR DELETE USING (gym_id = auth.uid());
  END IF;
END $$;
