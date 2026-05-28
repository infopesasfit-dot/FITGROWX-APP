-- ============================================================
-- FitGrowX Platform Layer
-- - platform_owner role
-- - vault CMS tables
-- - platform CRM tables
-- ============================================================

-- ── profiles.role extended with platform_owner ──────────────
ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'admin';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'profiles'
      AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'student', 'platform_owner'));

-- ── helper: platform owner check ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_owner(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = user_id
      AND role = 'platform_owner'
  );
$$;

-- ── generic updated_at trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── vault CMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS vault_categories_updated_at ON vault_categories;
CREATE TRIGGER vault_categories_updated_at
  BEFORE UPDATE ON vault_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS vault_resources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       UUID REFERENCES vault_categories(id) ON DELETE SET NULL,
  slug              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  format            TEXT,
  read_time_minutes INT,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  objective         TEXT,
  outcome           TEXT,
  cover_url         TEXT,
  content           JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vault_resources_category_idx ON vault_resources(category_id);
CREATE INDEX IF NOT EXISTS vault_resources_status_idx ON vault_resources(status);

DROP TRIGGER IF EXISTS vault_resources_updated_at ON vault_resources;
CREATE TRIGGER vault_resources_updated_at
  BEFORE UPDATE ON vault_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE vault_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_resources ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_categories' AND policyname = 'platform_owner_manage_categories'
  ) THEN
    CREATE POLICY "platform_owner_manage_categories"
    ON vault_categories
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_resources' AND policyname = 'platform_owner_manage_resources'
  ) THEN
    CREATE POLICY "platform_owner_manage_resources"
    ON vault_resources
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;
END $$;

-- Seed initial categories for the CMS
INSERT INTO vault_categories (slug, title, description, icon, sort_order, is_active)
VALUES
  ('ventas-captacion', 'Ventas y captación', 'Scripts, campañas, ofertas y procesos para convertir más leads en alumnos.', 'TrendingUp', 10, true),
  ('operacion-gimnasio', 'Operación del gimnasio', 'Checklists, SOPs y guías prácticas para ordenar el día a día del negocio.', 'ClipboardList', 20, true),
  ('experiencia-alumno', 'Experiencia del alumno', 'Material para mejorar onboarding, retención, seguimiento y comunidad.', 'Users', 30, true),
  ('tutoriales-fitgrowx', 'Tutoriales FitGrowX', 'Guías para usar mejor la plataforma en alumnos, clases, membresías y automatizaciones.', 'MonitorSmartphone', 40, true)
ON CONFLICT (slug) DO UPDATE
SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ── platform CRM ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT,
  business_name     TEXT,
  email             TEXT,
  phone             TEXT,
  source            TEXT,
  status            TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'won', 'lost')),
  notes             TEXT,
  assigned_to       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contact_at   TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_leads_status_idx ON platform_leads(status);
CREATE INDEX IF NOT EXISTS platform_leads_email_idx ON platform_leads(email);

DROP TRIGGER IF EXISTS platform_leads_updated_at ON platform_leads;
CREATE TRIGGER platform_leads_updated_at
  BEFORE UPDATE ON platform_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS platform_accounts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  platform_lead_id   UUID REFERENCES platform_leads(id) ON DELETE SET NULL,
  company_name       TEXT NOT NULL,
  owner_name         TEXT,
  email              TEXT,
  phone              TEXT,
  source             TEXT,
  status             TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('lead', 'trial', 'active', 'paused', 'churned')),
  subscription_plan  TEXT,
  onboarding_stage   TEXT NOT NULL DEFAULT 'new',
  monthly_value      NUMERIC(12,2),
  notes              TEXT,
  assigned_to        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contact_at    TIMESTAMPTZ,
  next_follow_up_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_accounts_status_idx ON platform_accounts(status);
CREATE INDEX IF NOT EXISTS platform_accounts_auth_user_idx ON platform_accounts(auth_user_id);

DROP TRIGGER IF EXISTS platform_accounts_updated_at ON platform_accounts;
CREATE TRIGGER platform_accounts_updated_at
  BEFORE UPDATE ON platform_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS platform_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
  platform_lead_id    UUID REFERENCES platform_leads(id) ON DELETE CASCADE,
  body                TEXT NOT NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    platform_account_id IS NOT NULL
    OR platform_lead_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS platform_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_account_id UUID REFERENCES platform_accounts(id) ON DELETE CASCADE,
  platform_lead_id    UUID REFERENCES platform_leads(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'archived')),
  due_at              TIMESTAMPTZ,
  assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    platform_account_id IS NOT NULL
    OR platform_lead_id IS NOT NULL
  )
);

DROP TRIGGER IF EXISTS platform_tasks_updated_at ON platform_tasks;
CREATE TRIGGER platform_tasks_updated_at
  BEFORE UPDATE ON platform_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE platform_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_leads' AND policyname = 'platform_owner_manage_platform_leads'
  ) THEN
    CREATE POLICY "platform_owner_manage_platform_leads"
    ON platform_leads
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_accounts' AND policyname = 'platform_owner_manage_platform_accounts'
  ) THEN
    CREATE POLICY "platform_owner_manage_platform_accounts"
    ON platform_accounts
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_notes' AND policyname = 'platform_owner_manage_platform_notes'
  ) THEN
    CREATE POLICY "platform_owner_manage_platform_notes"
    ON platform_notes
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_tasks' AND policyname = 'platform_owner_manage_platform_tasks'
  ) THEN
    CREATE POLICY "platform_owner_manage_platform_tasks"
    ON platform_tasks
    FOR ALL
    TO authenticated
    USING (public.is_platform_owner(auth.uid()))
    WITH CHECK (public.is_platform_owner(auth.uid()));
  END IF;
END $$;
