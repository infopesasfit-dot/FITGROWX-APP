DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_accounts'
      AND policyname = 'gym_owner_read_own_platform_account'
  ) THEN
    CREATE POLICY "gym_owner_read_own_platform_account"
      ON platform_accounts
      FOR SELECT
      TO authenticated
      USING (auth_user_id = auth.uid());
  END IF;
END $$;
