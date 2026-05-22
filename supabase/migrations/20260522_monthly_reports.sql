-- Migration: monthly_reports table for closed monthly snapshots
-- Bloque 3 Fase 1.5: cierre manual de mes

-- Tabla que guarda snapshots inmutables al cerrar un mes
CREATE TABLE IF NOT EXISTS monthly_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id          UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  year_month      TEXT NOT NULL,
  closed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  snapshot_data   JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(gym_id, year_month)
);

-- Validación: year_month debe ser formato YYYY-MM
ALTER TABLE monthly_reports
  ADD CONSTRAINT monthly_reports_year_month_format
  CHECK (year_month ~ '^\d{4}-\d{2}$');

-- Index para queries por gym + mes
CREATE INDEX IF NOT EXISTS idx_monthly_reports_gym_yearmonth
  ON monthly_reports(gym_id, year_month);

-- RLS
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios pueden leer reportes de su propio gym
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_reports' AND policyname = 'users read own gym reports'
  ) THEN
    CREATE POLICY "users read own gym reports"
    ON monthly_reports FOR SELECT
    USING (
      gym_id IN (SELECT gym_id FROM profiles WHERE id = auth.uid())
    );
  END IF;
END $$;

-- Policy: solo admin del gym puede insertar (cerrar mes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'monthly_reports' AND policyname = 'admin insert own gym reports'
  ) THEN
    CREATE POLICY "admin insert own gym reports"
    ON monthly_reports FOR INSERT
    WITH CHECK (
      gym_id IN (
        SELECT gym_id FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- NOTA: NO se permite UPDATE ni DELETE intencionalmente.
-- Los snapshots son inmutables una vez creados.
-- Si hay que corregir un mes, contactar soporte / borrar manualmente.
