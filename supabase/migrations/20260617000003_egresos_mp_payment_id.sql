-- Add mp_payment_id to egresos for idempotent MP webhook inserts
ALTER TABLE egresos ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS egresos_mp_payment_id_key
  ON egresos (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
