-- ============================================================
-- FitGrowX — Migraciones pendientes al 2026-04-27
-- Pegar completo en el SQL Editor de Supabase y ejecutar.
-- Todas usan IF NOT EXISTS / IF EXISTS → son idempotentes.
-- ============================================================
--
-- 🆕 NUEVA MIGRACIÓN (2026-05-19): WA Metrics + Cooldowns
--    Línea 620+: Validación ventana horaria, cooldowns, tracking de bloqueos
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


-- ── 12. Security hardening: profiles + views invoker ─────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'users read own profile'
  ) THEN
    CREATE POLICY "users read own profile"
      ON profiles FOR SELECT
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'users insert own profile'
  ) THEN
    CREATE POLICY "users insert own profile"
      ON profiles FOR INSERT
      WITH CHECK (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'users update own profile'
  ) THEN
    CREATE POLICY "users update own profile"
      ON profiles FOR UPDATE
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'admin reads gym profiles'
  ) THEN
    CREATE POLICY "admin reads gym profiles"
      ON profiles FOR SELECT
      USING (
        gym_id = (SELECT gym_id FROM profiles p2 WHERE p2.id = auth.uid())
        AND id <> auth.uid()
      );
  END IF;
END $$;

CREATE OR REPLACE VIEW alumnos_para_recordatorio
WITH (security_invoker = true) AS
  SELECT
    a.id,
    a.full_name,
    a.phone,
    a.status,
    a.next_expiration_date,
    p.nombre AS plan_nombre,
    g.name AS gym_nombre
  FROM alumnos a
  LEFT JOIN planes p ON p.id = a.plan_id
  JOIN gyms g ON g.id = a.gym_id
  WHERE
    a.status = 'activo'
    AND a.next_expiration_date = current_date + interval '3 days';

CREATE OR REPLACE VIEW alumnos_vencidos
WITH (security_invoker = true) AS
  SELECT
    a.id,
    a.full_name,
    a.phone,
    a.next_expiration_date,
    p.nombre AS plan_nombre,
    g.name AS gym_nombre
  FROM alumnos a
  LEFT JOIN planes p ON p.id = a.plan_id
  JOIN gyms g ON g.id = a.gym_id
  WHERE a.status = 'vencido';

CREATE OR REPLACE VIEW alumnos_sin_pago_reciente
WITH (security_invoker = true) AS
  SELECT
    a.id,
    a.full_name,
    a.phone,
    a.last_payment_date,
    a.next_expiration_date,
    g.name AS gym_nombre
  FROM alumnos a
  JOIN gyms g ON g.id = a.gym_id
  WHERE
    a.status = 'activo'
    AND (
      a.last_payment_date IS NULL
      OR a.last_payment_date < current_date - interval '35 days'
    );


-- ── 13. Aislar roles en profiles (staff no hereda lectura admin) ──
DROP POLICY IF EXISTS "admin reads gym profiles" ON profiles;
DROP POLICY IF EXISTS "users insert own profile" ON profiles;
DROP POLICY IF EXISTS "users update own profile" ON profiles;

CREATE POLICY "admin reads gym profiles"
  ON profiles FOR SELECT
  USING (
    id <> auth.uid()
    AND gym_id = (
      SELECT p2.gym_id
      FROM profiles p2
      WHERE p2.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM profiles p3
      WHERE p3.id = auth.uid()
        AND p3.role IN ('admin', 'platform_owner')
    )
  );


-- ── 11. Promos de membresías y descuentos guiados ────────────
CREATE TABLE IF NOT EXISTS gym_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  promo_type TEXT NOT NULL DEFAULT 'descuento',
  discount_type TEXT NOT NULL DEFAULT 'porcentaje',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gym_promotions_type_check'
  ) THEN
    ALTER TABLE gym_promotions
      ADD CONSTRAINT gym_promotions_type_check
      CHECK (promo_type IN ('descuento', 'referido', '2x1'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gym_promotions_discount_type_check'
  ) THEN
    ALTER TABLE gym_promotions
      ADD CONSTRAINT gym_promotions_discount_type_check
      CHECK (discount_type IN ('monto', 'porcentaje'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gym_promotions_gym_id ON gym_promotions(gym_id);

ALTER TABLE gym_promotions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gym_promotions' AND policyname = 'owner select gym promotions'
  ) THEN
    CREATE POLICY "owner select gym promotions" ON gym_promotions FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gym_promotions' AND policyname = 'owner upsert gym promotions'
  ) THEN
    CREATE POLICY "owner upsert gym promotions" ON gym_promotions FOR ALL TO authenticated
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
      WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;


-- ── 11. Unificar FitGrowX a un único plan ──────────────────────
UPDATE gyms
SET plan_type = 'crecimiento'
WHERE plan_type IN ('gestion', 'full_marca');

ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_plan_type_check;

ALTER TABLE gyms ADD CONSTRAINT gyms_plan_type_check
  CHECK (plan_type IS NULL OR plan_type IN ('crecimiento'));


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


-- ── 8. 20260501_planes_access_rules ─────────────────────────
ALTER TABLE planes
  ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'libre',
  ADD COLUMN IF NOT EXISTS classes_per_week INT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'planes_access_type_check'
  ) THEN
    ALTER TABLE planes
      ADD CONSTRAINT planes_access_type_check
      CHECK (access_type IN ('libre', 'clases_por_semana'));
  END IF;
END $$;


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

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ 🔒 CRITICAL SAFETY LAYER (2026-05-19)                          ║
-- ║    Opt-in tracking, bounce detection, gym rate limits          ║
-- ╚════════════════════════════════════════════════════════════════╝

-- ── 20260519_wa_critical_safety: Opt-in + rate limits ──
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS whatsapp_opted_in BOOLEAN DEFAULT TRUE;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS whatsapp_opted_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS phone_is_invalid BOOLEAN DEFAULT FALSE;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS phone_invalid_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS wa_gym_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gym_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_wa_gym_rate_limits_window ON wa_gym_rate_limits(gym_id, window_start DESC);

CREATE OR REPLACE FUNCTION check_gym_wa_rate_limit(p_gym_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE(allowed BOOLEAN, count_used INTEGER, limit_val INTEGER) AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_count INTEGER;
BEGIN
  v_window_start := DATE_TRUNC('minute', NOW());

  INSERT INTO wa_gym_rate_limits (gym_id, window_start, message_count)
  VALUES (p_gym_id, v_window_start, 0)
  ON CONFLICT (gym_id, window_start) DO UPDATE
  SET message_count = wa_gym_rate_limits.message_count + 1;

  SELECT message_count INTO v_count
  FROM wa_gym_rate_limits
  WHERE gym_id = p_gym_id AND window_start = v_window_start;

  RETURN QUERY SELECT (v_count <= p_limit), v_count, p_limit;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION check_gym_wa_rate_limit TO authenticated;

-- ── 20260519_wa_motor_events: Webhook events from WhatsApp motor ──
CREATE TABLE IF NOT EXISTS wa_motor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'block_detected', 'invalid_phone', 'rate_limited', 'delivery_failed'
  session TEXT NOT NULL,
  phone TEXT NOT NULL,
  reason TEXT,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_motor_events_created ON wa_motor_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_motor_events_type ON wa_motor_events(event_type);
CREATE INDEX IF NOT EXISTS idx_wa_motor_events_phone ON wa_motor_events(phone);

-- ── 20260515_wa_mensajes_log: Base table for WhatsApp messaging ──
CREATE TABLE IF NOT EXISTS wa_mensajes_log (
  id       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id   uuid NOT NULL,
  tipo     text NOT NULL,
  sent_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS wa_mensajes_log_gym_sent
  ON wa_mensajes_log(gym_id, sent_at DESC);

-- ── 20260516_wa_mensajes_log_alumno: Add alumno tracking ──
ALTER TABLE wa_mensajes_log
  ADD COLUMN IF NOT EXISTS alumno_id   uuid REFERENCES alumnos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alumno_name text;

-- ╔════════════════════════════════════════════════════════════════╗
-- ║ 🆕 NUEVA MIGRACIÓN: WhatsApp Metrics + Cooldowns (2026-05-19) ║
-- ║    Ventanas horarias, validación de bloqueos, tracking latencia║
-- ╚════════════════════════════════════════════════════════════════╝

-- ── 20260519_wa_metrics_tracking: WhatsApp metrics + cooldowns ──
CREATE TABLE IF NOT EXISTS wa_contact_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  blocked_count INTEGER DEFAULT 0,
  last_blocked_at TIMESTAMP WITH TIME ZONE,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  failed_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(gym_id, alumno_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_contact_metrics_cooldown ON wa_contact_metrics(cooldown_until) WHERE cooldown_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS wa_platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_blocked INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  block_ratio DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(period_start, period_end)
);

ALTER TABLE wa_mensajes_log ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';
ALTER TABLE wa_mensajes_log ADD COLUMN IF NOT EXISTS latency_ms INTEGER;
ALTER TABLE wa_mensajes_log ADD COLUMN IF NOT EXISTS motor_status_code INTEGER;
ALTER TABLE wa_mensajes_log ADD COLUMN IF NOT EXISTS motor_error TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_mensajes_log_status ON wa_mensajes_log(status);
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_log_sent_at ON wa_mensajes_log(sent_at DESC);

DO $$ BEGIN
  DROP FUNCTION IF EXISTS update_wa_contact_metrics_after_send() CASCADE;
  DROP FUNCTION IF EXISTS mark_wa_contact_blocked() CASCADE;
END $$;

CREATE FUNCTION update_wa_contact_metrics_after_send()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.alumno_id IS NOT NULL AND NEW.gym_id IS NOT NULL THEN
    INSERT INTO wa_contact_metrics (gym_id, alumno_id, last_message_at)
    VALUES (NEW.gym_id, NEW.alumno_id, NEW.sent_at)
    ON CONFLICT (gym_id, alumno_id) DO UPDATE
    SET last_message_at = NEW.sent_at,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_wa_contact_metrics ON wa_mensajes_log;
CREATE TRIGGER trg_update_wa_contact_metrics
AFTER INSERT ON wa_mensajes_log
FOR EACH ROW
EXECUTE FUNCTION update_wa_contact_metrics_after_send();

CREATE FUNCTION mark_wa_contact_blocked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'blocked' AND NEW.alumno_id IS NOT NULL AND NEW.gym_id IS NOT NULL THEN
    INSERT INTO wa_contact_metrics (gym_id, alumno_id, blocked_count, last_blocked_at, cooldown_until)
    VALUES (NEW.gym_id, NEW.alumno_id, 1, NEW.sent_at, NOW() + INTERVAL '24 hours')
    ON CONFLICT (gym_id, alumno_id) DO UPDATE
    SET blocked_count = LEAST(wa_contact_metrics.blocked_count + 1, 999),
        last_blocked_at = NEW.sent_at,
        cooldown_until = CASE
          WHEN (wa_contact_metrics.blocked_count + 1) >= 5 THEN NOW() + INTERVAL '30 days'
          WHEN (wa_contact_metrics.blocked_count + 1) >= 3 THEN NOW() + INTERVAL '24 hours'
          ELSE NOW() + INTERVAL '2 hours'
        END,
        updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_wa_contact_blocked ON wa_mensajes_log;
CREATE TRIGGER trg_mark_wa_contact_blocked
AFTER INSERT ON wa_mensajes_log
FOR EACH ROW
EXECUTE FUNCTION mark_wa_contact_blocked();

GRANT SELECT ON wa_contact_metrics TO postgres, authenticated;
GRANT SELECT ON wa_platform_metrics TO postgres, authenticated;

-- ── Staff Payment Reminders (2026-05-19) ──────────────────────────────────
ALTER TABLE gym_settings
ADD COLUMN IF NOT EXISTS staff_payment_reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS staff_payment_reminder_days INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS staff_payment_reminder_day_of_week INTEGER,
ADD COLUMN IF NOT EXISTS last_staff_payment_reminder_sent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_staff_payment_registered_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS staff_payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  sent_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_payment_reminders_gym_id ON staff_payment_reminders(gym_id);
CREATE INDEX IF NOT EXISTS idx_staff_payment_reminders_completed_at ON staff_payment_reminders(completed_at);

-- Trigger to update last_staff_payment_registered_at when a "Sueldos" egreso is created
CREATE OR REPLACE FUNCTION update_staff_payment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria = 'Sueldos' THEN
    UPDATE gym_settings
    SET last_staff_payment_registered_at = NEW.fecha::TIMESTAMP
    WHERE gym_id = NEW.gym_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_staff_payment_timestamp ON egresos;
CREATE TRIGGER trigger_staff_payment_timestamp
AFTER INSERT ON egresos
FOR EACH ROW
EXECUTE FUNCTION update_staff_payment_timestamp();

GRANT SELECT, INSERT, UPDATE ON staff_payment_reminders TO postgres, authenticated;
GRANT INSERT, UPDATE ON wa_contact_metrics TO postgres, authenticated;
