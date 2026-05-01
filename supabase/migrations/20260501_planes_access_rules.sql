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
