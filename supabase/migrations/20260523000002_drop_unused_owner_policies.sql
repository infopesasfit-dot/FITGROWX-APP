BEGIN;

-- Migración: Restrict whatsapp_sessions to service_role only
-- Fecha: 2026-05-23
-- Razón: creds_json should NEVER be readable by client/owner auth.
--        All access is backend-only (webhooks, crons, platform admin).
--        3 owner policies exist but are dead code (never used).

-- ── 1. Remove insecure owner policies (dead code) ─────────────────────
DROP POLICY IF EXISTS "owner select whatsapp_sessions" ON whatsapp_sessions;
DROP POLICY IF EXISTS "owner upsert whatsapp_sessions" ON whatsapp_sessions;
DROP POLICY IF EXISTS "owner delete whatsapp_sessions" ON whatsapp_sessions;

-- ── 2. Ensure RLS is enabled ─────────────────────────────────────────
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- ── 3. Create service_role-only policy ──────────────────────────────
DROP POLICY IF EXISTS "restrict_credentials_to_service_role" ON whatsapp_sessions;
CREATE POLICY "restrict_credentials_to_service_role" ON whatsapp_sessions
  FOR ALL USING (false) WITH CHECK (false);

-- ── 4. Verification: exactly 1 policy must exist, else rollback ──────
DO $$
DECLARE
  policy_count int;
BEGIN
  SELECT count(*) INTO policy_count FROM pg_policies WHERE tablename = 'whatsapp_sessions';
  IF policy_count != 1 THEN
    RAISE EXCEPTION 'Verification failed: expected 1 policy on whatsapp_sessions, got %', policy_count;
  END IF;
  RAISE NOTICE 'whatsapp_sessions is now restricted to service_role only. Policy count: %', policy_count;
END $$;

COMMIT;
