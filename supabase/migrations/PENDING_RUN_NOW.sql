-- ============================================================
-- FitGrowX — Migraciones pendientes al 2026-04-27
-- Pegar completo en el SQL Editor de Supabase y ejecutar.
-- Todas usan IF NOT EXISTS / IF EXISTS → son idempotentes.
-- ============================================================


-- ── -1. 20260421_asistencias (tabla faltante + RLS correcto) ──
CREATE TABLE IF NOT EXISTS asistencias (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id     UUID NOT NULL,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  hora       TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alumno_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_gym_id ON asistencias(gym_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_alumno  ON asistencias(alumno_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha   ON asistencias(fecha);

ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  -- Fix: old policy used gym_id = auth.uid() which is always false
  DROP POLICY IF EXISTS "owner_asistencias" ON asistencias;
  CREATE POLICY "owner_asistencias" ON asistencias FOR ALL TO authenticated
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asistencias' AND policyname='service_asistencias') THEN
    CREATE POLICY "service_asistencias" ON asistencias FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;


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


-- ── 1. 20260414_pagos_v2 (columnas faltantes en pagos) ────────
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS method          TEXT    NOT NULL DEFAULT 'efectivo'
    CHECK (method IN ('efectivo','transferencia','mercadopago')),
  ADD COLUMN IF NOT EXISTS status          TEXT    NOT NULL DEFAULT 'validado'
    CHECK (status IN ('pendiente','validado','rechazado')),
  ADD COLUMN IF NOT EXISTS concepto        TEXT    NOT NULL DEFAULT 'membresia'
    CHECK (concepto IN ('membresia','clase','producto')),
  ADD COLUMN IF NOT EXISTS descripcion     TEXT,
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT,
  ADD COLUMN IF NOT EXISTS validated_by    UUID REFERENCES profiles(id);

DROP POLICY IF EXISTS "gym owner updates pagos" ON pagos;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pagos' AND policyname='gym owner updates pagos') THEN
    CREATE POLICY "gym owner updates pagos" ON pagos FOR UPDATE
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gym_cuentas (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id     UUID    NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  tipo       TEXT    NOT NULL CHECK (tipo IN ('alias','cbu','mercadopago')),
  valor      TEXT    NOT NULL,
  titular    TEXT,
  banco      TEXT,
  activa     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gym_cuentas_gym_id ON gym_cuentas(gym_id);
ALTER TABLE gym_cuentas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_cuentas' AND policyname='gym reads own cuentas') THEN
    CREATE POLICY "gym reads own cuentas"   ON gym_cuentas FOR SELECT USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_cuentas' AND policyname='gym inserts own cuentas') THEN
    CREATE POLICY "gym inserts own cuentas" ON gym_cuentas FOR INSERT WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_cuentas' AND policyname='gym updates own cuentas') THEN
    CREATE POLICY "gym updates own cuentas" ON gym_cuentas FOR UPDATE USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gym_cuentas' AND policyname='gym deletes own cuentas') THEN
    CREATE POLICY "gym deletes own cuentas" ON gym_cuentas FOR DELETE USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;


-- ── 2. 20260426_subscription_notif_tracking ──────────────────
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


-- ── 2b. 20260427_planes_duracion_dias_active ─────────────────
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS duracion_dias INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT true;


-- ── 3. 20260427_missing_columns ──────────────────────────────
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS wa_status   TEXT,
  ADD COLUMN IF NOT EXISTS wa_phone    TEXT,
  ADD COLUMN IF NOT EXISTS wa_battery  INT,
  ADD COLUMN IF NOT EXISTS wa_plugged  BOOLEAN,
  ADD COLUMN IF NOT EXISTS wa_signal   INT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
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


-- ── 7. 20260501_monthly_dashboard_reports ────────────────────
CREATE TABLE IF NOT EXISTS monthly_dashboard_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id       UUID NOT NULL,
  report_month DATE NOT NULL,
  email        TEXT NOT NULL,
  resend_id    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gym_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_dashboard_reports_gym_month
  ON monthly_dashboard_reports(gym_id, report_month DESC);


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


-- ── 10. Staff support: email + full_name en profiles ────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email     TEXT,
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Admin puede leer perfiles de staff de su mismo gym
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='admin reads gym profiles') THEN
    CREATE POLICY "admin reads gym profiles" ON profiles FOR SELECT
      USING (
        gym_id = (SELECT gym_id FROM profiles p2 WHERE p2.id = auth.uid())
        AND id != auth.uid()
      );
  END IF;
END $$;


-- ── 9. Storage bucket comprobantes (público para getPublicUrl) ─
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes',
  'comprobantes',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'comprobantes upload authenticated'
  ) THEN
    CREATE POLICY "comprobantes upload authenticated"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'comprobantes');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'comprobantes public read'
  ) THEN
    CREATE POLICY "comprobantes public read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'comprobantes');
  END IF;
END $$;
