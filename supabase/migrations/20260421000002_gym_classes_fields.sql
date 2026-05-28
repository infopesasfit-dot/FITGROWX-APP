ALTER TABLE gym_classes
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS coach_name TEXT;

DO $$ BEGIN
  ALTER TABLE gym_classes ADD CONSTRAINT gym_classes_event_type_check CHECK (event_type IN ('regular', 'especial'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
