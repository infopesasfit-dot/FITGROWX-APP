-- reseller_commissions had RLS ENABLED (20260515000009) but no explicit policy,
-- leaving the table closed to everyone except BYPASSRLS roles. Add an explicit
-- service_role policy so backend access is intentional, not incidental.
-- (withdrawal_requests already got its service_role_all policy in 20260605162722.)

ALTER TABLE reseller_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON reseller_commissions;
CREATE POLICY "service_role_all" ON reseller_commissions TO service_role USING (true) WITH CHECK (true);
