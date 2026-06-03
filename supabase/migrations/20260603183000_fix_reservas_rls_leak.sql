-- Fix cross-tenant leak on reservas.
-- Empirically verified (anon key, unauthenticated): anon could SELECT every
-- gym's reservas. The 2026-05-07 fix (owner_reservas_select) did not take in
-- prod — the public USING(true) policy drifted and remained live.
--
-- reservas carries alumno_id/clase_id/gym_id (cross-tenant booking records).
-- Only reader via the anon (browser) client is the AUTHENTICATED dashboard
-- (clases page, read-only); all writes go through service-role API routes and
-- the alumno reads its own reservas server-side. So locking SELECT to the
-- owning gym + service_role is safe.

ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

-- Drift-safe: drop every existing policy regardless of name, then recreate.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reservas'
  LOOP
    EXECUTE format('DROP POLICY %I ON reservas', pol.policyname);
  END LOOP;
END $$;

-- Authenticated gym owner/staff: only their own gym's reservas.
CREATE POLICY "reservas_owner_select" ON reservas FOR SELECT TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- Service role (API routes) — full access.
CREATE POLICY "reservas_service_all" ON reservas FOR ALL TO service_role
  USING (true) WITH CHECK (true);
