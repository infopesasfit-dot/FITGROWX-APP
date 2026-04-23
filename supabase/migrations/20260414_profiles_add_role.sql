-- Add role column to profiles
-- Values: 'admin' | 'staff' | 'student'
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('admin', 'staff', 'student'));

-- All existing rows default to 'admin' (already handled by DEFAULT above)
-- To promote a user to staff or student, run:
--   UPDATE profiles SET role = 'staff'   WHERE id = '<user_uuid>';
--   UPDATE profiles SET role = 'student' WHERE id = '<user_uuid>';

-- RLS: users can read their own profile (needed by middleware)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'users read own profile'
  ) THEN
    CREATE POLICY "users read own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());
  END IF;
END $$;
