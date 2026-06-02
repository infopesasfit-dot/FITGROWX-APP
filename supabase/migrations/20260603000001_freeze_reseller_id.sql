-- Prevent reseller_id from being changed once assigned.
-- Commission integrity depends on gym→reseller attribution being immutable after the first payment.
CREATE OR REPLACE FUNCTION trg_freeze_reseller_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.reseller_id IS NOT NULL AND NEW.reseller_id IS DISTINCT FROM OLD.reseller_id THEN
    RAISE EXCEPTION 'reseller_id cannot be modified once assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_reseller_id ON gyms;
CREATE TRIGGER freeze_reseller_id
  BEFORE UPDATE ON gyms
  FOR EACH ROW
  EXECUTE FUNCTION trg_freeze_reseller_id();
