-- Allow gym owner to manage their own classes (insert, update, delete)
CREATE POLICY IF NOT EXISTS "owner_gym_classes"
  ON gym_classes FOR ALL TO authenticated
  USING (gym_id = auth.uid())
  WITH CHECK (gym_id = auth.uid());

-- Allow gym owner to read/manage reservas via authenticated role
CREATE POLICY IF NOT EXISTS "owner_reservas_anon"
  ON reservas FOR SELECT USING (true);
