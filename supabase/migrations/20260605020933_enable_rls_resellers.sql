ALTER TABLE resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_applications ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede operar estas tablas directamente
DROP POLICY IF EXISTS "service_role_all" ON resellers;
DROP POLICY IF EXISTS "service_role_all" ON reseller_applications;
CREATE POLICY "service_role_all" ON resellers TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON reseller_applications TO service_role USING (true) WITH CHECK (true);

-- El portal reseller lee sus propios datos via API con admin client — no necesita policy de auth
