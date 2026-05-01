DROP POLICY IF EXISTS "admin reads gym profiles" ON profiles;
DROP POLICY IF EXISTS "users insert own profile" ON profiles;
DROP POLICY IF EXISTS "users update own profile" ON profiles;

CREATE POLICY "admin reads gym profiles"
  ON profiles FOR SELECT
  USING (
    id <> auth.uid()
    AND gym_id = (
      SELECT p2.gym_id
      FROM profiles p2
      WHERE p2.id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM profiles p3
      WHERE p3.id = auth.uid()
        AND p3.role IN ('admin', 'platform_owner')
    )
  );
