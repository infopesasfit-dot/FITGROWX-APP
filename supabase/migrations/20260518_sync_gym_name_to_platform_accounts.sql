-- Trigger: when gym_settings.gym_name changes, update platform_accounts.company_name
-- Link: gym_settings.gym_id → profiles.gym_id → profiles.id = platform_accounts.auth_user_id

CREATE OR REPLACE FUNCTION sync_gym_name_to_platform_account()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_auth_user_id uuid;
BEGIN
  IF NEW.gym_name IS DISTINCT FROM OLD.gym_name AND NEW.gym_name IS NOT NULL THEN
    SELECT id INTO v_auth_user_id
    FROM profiles
    WHERE gym_id = NEW.gym_id
      AND role = 'admin'
    LIMIT 1;

    IF v_auth_user_id IS NOT NULL THEN
      UPDATE platform_accounts
      SET company_name = NEW.gym_name
      WHERE auth_user_id = v_auth_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_gym_name ON gym_settings;
CREATE TRIGGER trg_sync_gym_name
  AFTER UPDATE OF gym_name ON gym_settings
  FOR EACH ROW EXECUTE FUNCTION sync_gym_name_to_platform_account();

-- Backfill: update all accounts where gym has a real name set
UPDATE platform_accounts pa
SET company_name = gs.gym_name
FROM profiles p
JOIN gym_settings gs ON gs.gym_id = p.gym_id
WHERE p.id = pa.auth_user_id
  AND gs.gym_name IS NOT NULL
  AND gs.gym_name <> ''
  AND p.role = 'admin';
