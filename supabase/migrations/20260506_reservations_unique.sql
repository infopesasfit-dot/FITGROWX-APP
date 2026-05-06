-- Evita race condition: dos requests simultáneas no pueden crear dos reservas del mismo teléfono para la misma clase
ALTER TABLE class_reservations
  ADD CONSTRAINT IF NOT EXISTS class_reservations_class_phone_unique
  UNIQUE (class_id, lead_phone);
