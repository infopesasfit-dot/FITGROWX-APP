-- ============================================================
-- FitGrowX — Migraciones pendientes al 2026-04-27
-- Pegar completo en el SQL Editor de Supabase y ejecutar.
-- Todas usan IF NOT EXISTS / IF EXISTS → son idempotentes.
-- ============================================================


-- ── 0. 20260427_egresos (tabla faltante) ─────────────────────
CREATE TABLE IF NOT EXISTS egresos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL,
  titulo     TEXT NOT NULL,
  monto      NUMERIC(12,2) NOT NULL,
  categoria  TEXT NOT NULL DEFAULT 'Otros',
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egresos_gym_id ON egresos(gym_id);
CREATE INDEX IF NOT EXISTS idx_egresos_fecha  ON egresos(fecha);

ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner select egresos') THEN
    CREATE POLICY "owner select egresos" ON egresos FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner insert egresos') THEN
    CREATE POLICY "owner insert egresos" ON egresos FOR INSERT
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner update egresos') THEN
    CREATE POLICY "owner update egresos" ON egresos FOR UPDATE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner delete egresos') THEN
    CREATE POLICY "owner delete egresos" ON egresos FOR DELETE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;


-- ── 1. 20260426_subscription_notif_tracking ──────────────────
ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS trial_notif_d13_sent_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_notif_d15_sent_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_notif_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at              TIMESTAMPTZ;

ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS vencimiento_activo  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vencimiento_dias    INT     NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS vencimiento_msg     TEXT;

ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS notif_vencimiento_para DATE;


-- ── 2. 20260426_rls_missing_tables ───────────────────────────
DO $$ BEGIN

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'egresos') THEN
    EXECUTE 'ALTER TABLE egresos ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner select egresos') THEN
      CREATE POLICY "owner select egresos" ON egresos FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner insert egresos') THEN
      CREATE POLICY "owner insert egresos" ON egresos FOR INSERT
        WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner update egresos') THEN
      CREATE POLICY "owner update egresos" ON egresos FOR UPDATE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner delete egresos') THEN
      CREATE POLICY "owner delete egresos" ON egresos FOR DELETE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prospectos') THEN
    EXECUTE 'ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='public insert prospectos') THEN
      CREATE POLICY "public insert prospectos" ON prospectos FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner select prospectos') THEN
      CREATE POLICY "owner select prospectos" ON prospectos FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner update prospectos') THEN
      CREATE POLICY "owner update prospectos" ON prospectos FOR UPDATE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner delete prospectos') THEN
      CREATE POLICY "owner delete prospectos" ON prospectos FOR DELETE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membresias') THEN
    EXECUTE 'ALTER TABLE membresias ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner select membresias') THEN
      CREATE POLICY "owner select membresias" ON membresias FOR SELECT
        USING (alumno_id IN (SELECT id FROM alumnos WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner insert membresias') THEN
      CREATE POLICY "owner insert membresias" ON membresias FOR INSERT
        WITH CHECK (alumno_id IN (SELECT id FROM alumnos WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner update membresias') THEN
      CREATE POLICY "owner update membresias" ON membresias FOR UPDATE
        USING (alumno_id IN (SELECT id FROM alumnos WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner delete membresias') THEN
      CREATE POLICY "owner delete membresias" ON membresias FOR DELETE
        USING (alumno_id IN (SELECT id FROM alumnos WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gyms') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gyms' AND policyname='gym updates own row') THEN
      CREATE POLICY "gym updates own row" ON gyms FOR UPDATE
        USING (id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users insert own profile') THEN
      CREATE POLICY "users insert own profile" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users update own profile') THEN
      CREATE POLICY "users update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_sessions') THEN
    EXECUTE 'ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner select whatsapp_sessions') THEN
      CREATE POLICY "owner select whatsapp_sessions" ON whatsapp_sessions FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_feedback') THEN
    EXECUTE 'ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY';
  END IF;

END $$;


-- ── 3. 20260427_missing_columns ──────────────────────────────
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS wa_status   TEXT,
  ADD COLUMN IF NOT EXISTS wa_phone    TEXT,
  ADD COLUMN IF NOT EXISTS wa_battery  INT,
  ADD COLUMN IF NOT EXISTS wa_plugged  BOOLEAN,
  ADD COLUMN IF NOT EXISTS wa_signal   INT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT;


-- ── 4. 20260427_membresias ───────────────────────────────────
CREATE TABLE IF NOT EXISTS membresias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  plan_id    UUID REFERENCES planes(id) ON DELETE SET NULL,
  estado     TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membresias_gym_id    ON membresias(gym_id);
CREATE INDEX IF NOT EXISTS idx_membresias_alumno_id ON membresias(alumno_id);
CREATE INDEX IF NOT EXISTS idx_membresias_estado    ON membresias(estado);

ALTER TABLE membresias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner_all') THEN
    CREATE POLICY "owner_all" ON membresias FOR ALL TO authenticated
      USING (gym_id = auth.uid()) WITH CHECK (gym_id = auth.uid());
  END IF;
END $$;


-- ── 5. 20260427_gym_settings_lead_auto_welcome ───────────────
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS lead_auto_welcome BOOLEAN NOT NULL DEFAULT true;


-- ── 6. 20260427_notifications_link ───────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS link TEXT;


-- ── 7. 20260427_prospectos (tabla faltante) ───────────────────
CREATE TABLE IF NOT EXISTS prospectos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID NOT NULL,
  full_name  TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  status     TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'contactado', 'descartado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, email)
);

CREATE INDEX IF NOT EXISTS idx_prospectos_gym_id ON prospectos(gym_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_status ON prospectos(status);

ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='public insert prospectos') THEN
    CREATE POLICY "public insert prospectos" ON prospectos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner select prospectos') THEN
    CREATE POLICY "owner select prospectos" ON prospectos FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner update prospectos') THEN
    CREATE POLICY "owner update prospectos" ON prospectos FOR UPDATE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner delete prospectos') THEN
    CREATE POLICY "owner delete prospectos" ON prospectos FOR DELETE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;


-- ── 8. 20260427_whatsapp_sessions (tabla faltante) ────────────
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     TEXT NOT NULL UNIQUE,
  creds_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_gym_id ON whatsapp_sessions(gym_id);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner select whatsapp_sessions') THEN
    CREATE POLICY "owner select whatsapp_sessions" ON whatsapp_sessions FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner upsert whatsapp_sessions') THEN
    CREATE POLICY "owner upsert whatsapp_sessions" ON whatsapp_sessions FOR ALL TO authenticated
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text)
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
  END IF;
END $$;
