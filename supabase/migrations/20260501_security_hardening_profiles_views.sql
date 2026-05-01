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
