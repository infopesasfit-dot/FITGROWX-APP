-- Evita race condition: dos requests simultáneas no pueden crear dos reservas del mismo teléfono para la misma clase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'class_reservations_class_phone_unique'
  ) THEN
    ALTER TABLE class_reservations
      ADD CONSTRAINT class_reservations_class_phone_unique
      UNIQUE (class_id, lead_phone);
  END IF;
END$$;
