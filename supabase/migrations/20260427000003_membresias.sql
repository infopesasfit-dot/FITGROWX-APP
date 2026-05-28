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
    CREATE POLICY "owner_all" ON membresias FOR ALL TO authenticated USING (gym_id = auth.uid()) WITH CHECK (gym_id = auth.uid());
  END IF;
END $$;
