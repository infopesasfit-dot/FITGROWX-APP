-- Block ANY change to reseller_id unless executed as service_role.
-- Fixes prior trigger that only blocked changes when OLD.reseller_id IS NOT NULL,
-- allowing a gym without a reseller to self-assign one.
CREATE OR REPLACE FUNCTION trg_freeze_reseller_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.reseller_id IS DISTINCT FROM NEW.reseller_id
     AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'reseller_id cannot be modified';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS freeze_reseller_id ON gyms;
CREATE TRIGGER freeze_reseller_id
  BEFORE UPDATE ON gyms
  FOR EACH ROW
  EXECUTE FUNCTION trg_freeze_reseller_id();
