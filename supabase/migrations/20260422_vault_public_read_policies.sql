DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'vault_categories'
      AND policyname = 'authenticated_read_active_vault_categories'
  ) THEN
    CREATE POLICY "authenticated_read_active_vault_categories"
    ON vault_categories
    FOR SELECT
    TO authenticated
    USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'vault_resources'
      AND policyname = 'authenticated_read_published_vault_resources'
  ) THEN
    CREATE POLICY "authenticated_read_published_vault_resources"
    ON vault_resources
    FOR SELECT
    TO authenticated
    USING (status = 'published');
  END IF;
END $$;
