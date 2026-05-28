-- ── Medidas corporales por alumno ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medidas_corporales (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      UUID NOT NULL,
  alumno_id   UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  peso_kg     NUMERIC(5,2) NOT NULL,
  grasa_pct   NUMERIC(4,1),
  cintura_cm  NUMERIC(5,1),
  notas       TEXT,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medidas_alumno_fecha ON medidas_corporales(alumno_id, fecha DESC);

ALTER TABLE medidas_corporales ENABLE ROW LEVEL SECURITY;

-- El alumno lee sus propias medidas vía token (service_role en la API route)
-- El gym owner lee las medidas de sus alumnos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'medidas_corporales' AND policyname = 'gym owner reads medidas'
  ) THEN
    CREATE POLICY "gym owner reads medidas" ON medidas_corporales FOR SELECT
      USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
  END IF;
END $$;
