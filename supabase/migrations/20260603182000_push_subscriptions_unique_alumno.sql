-- Formalizes the UNIQUE constraint on push_subscriptions.alumno_id required by
-- the app's upsert(..., { onConflict: "alumno_id" }) in /api/alumno/push-subscribe.
-- Idempotent: ADD CONSTRAINT has no IF NOT EXISTS, and prod may already have a
-- uniqueness guard (constraint or unique index) under any name. We detect either
-- and only add the named constraint when none exists.
DO $$
DECLARE
  existing_constraint text;
  existing_index text;
BEGIN
  SELECT conname INTO existing_constraint
  FROM pg_constraint
  WHERE conrelid = 'push_subscriptions'::regclass
    AND contype = 'u'
    AND conkey = ARRAY[(
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'push_subscriptions'::regclass AND attname = 'alumno_id'
    )];

  SELECT i.relname INTO existing_index
  FROM pg_index x
  JOIN pg_class i ON i.oid = x.indexrelid
  WHERE x.indrelid = 'push_subscriptions'::regclass
    AND x.indisunique
    AND x.indnkeyatts = 1
    AND x.indkey[0] = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'push_subscriptions'::regclass AND attname = 'alumno_id'
    )
  LIMIT 1;

  IF existing_constraint IS NOT NULL THEN
    RAISE NOTICE 'UNIQUE constraint on alumno_id already exists as %, skipping', existing_constraint;
  ELSIF existing_index IS NOT NULL THEN
    RAISE NOTICE 'UNIQUE index on alumno_id already exists as %, skipping', existing_index;
  ELSE
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_alumno_id_unique UNIQUE (alumno_id);
    RAISE NOTICE 'Added constraint push_subscriptions_alumno_id_unique';
  END IF;
END $$;
