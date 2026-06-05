-- Consolidated migration for missing reseller infrastructure.
-- NOTE: schemas below match the consuming code (NOT the literal pasted SQL):
--   * reseller_audit_log uses entity_type/entity_id/before/after/notes
--     (app/api/platform/resellers/route.ts → writeResellerAuditLog).
--   * withdrawal_requests already exists (20260515000013) with requested_at/paid_at;
--     the IF NOT EXISTS below is a safety net only and keeps that real schema.

-- ── 1. reseller_audit_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reseller_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID,
  entity_type TEXT NOT NULL,                 -- "reseller" | "application"
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL,                 -- approve | reject | update | soft_delete | category_change | create
  before      JSONB,
  after       JSONB,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reseller_audit_entity ON reseller_audit_log(entity_type, entity_id);

ALTER TABLE reseller_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON reseller_audit_log;
CREATE POLICY "service_role_all" ON reseller_audit_log TO service_role USING (true) WITH CHECK (true);

-- ── 2. withdrawal_requests (safety net — already created in 20260515000013) ──
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id  UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paid | rejected
  notes        TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_reseller ON withdrawal_requests(reseller_id);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON withdrawal_requests;
CREATE POLICY "service_role_all" ON withdrawal_requests TO service_role USING (true) WITH CHECK (true);

-- Link commissions to the withdrawal that settles them.
ALTER TABLE reseller_commissions
  ADD COLUMN IF NOT EXISTS withdrawal_request_id UUID REFERENCES withdrawal_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_withdrawal ON reseller_commissions(withdrawal_request_id);

-- ── 3. RPCs ─────────────────────────────────────────────────────────────────

-- create_reseller_withdrawal: bundles a reseller's pending commissions into a
-- single withdrawal request. Returns the new request id + total amount.
-- Errors (matched by route via message): pending_withdrawal_exists,
-- minimum_withdrawal_not_met.
-- DROP first: a live copy (DB drift, never in a migration) has an incompatible
-- return type, so CREATE OR REPLACE cannot alter it.
DROP FUNCTION IF EXISTS create_reseller_withdrawal(UUID, NUMERIC);
CREATE FUNCTION create_reseller_withdrawal(
  p_reseller_id UUID,
  p_min_amount  NUMERIC
)
RETURNS TABLE (withdrawal_request_id UUID, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_id    UUID;
BEGIN
  -- Block if there's already an open request.
  IF EXISTS (
    SELECT 1 FROM withdrawal_requests
    WHERE reseller_id = p_reseller_id
      AND status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'pending_withdrawal_exists';
  END IF;

  -- Sum unsettled pending commissions.
  SELECT COALESCE(SUM(commission_amount), 0)
    INTO v_total
    FROM reseller_commissions
   WHERE reseller_id = p_reseller_id
     AND status = 'pending'
     AND withdrawal_request_id IS NULL;

  IF v_total < p_min_amount THEN
    RAISE EXCEPTION 'minimum_withdrawal_not_met';
  END IF;

  INSERT INTO withdrawal_requests (reseller_id, amount, status)
  VALUES (p_reseller_id, v_total, 'pending')
  RETURNING id INTO v_id;

  -- Mark the bundled commissions as in-flight and link them.
  UPDATE reseller_commissions
     SET status = 'processing',
         withdrawal_request_id = v_id
   WHERE reseller_id = p_reseller_id
     AND status = 'pending'
     AND withdrawal_request_id IS NULL;

  RETURN QUERY SELECT v_id, v_total;
END;
$$;

-- pay_reseller_withdrawal: marks a withdrawal (and its linked commissions) paid.
-- Returns reseller_id + amount for the post-payment WA notification.
DROP FUNCTION IF EXISTS pay_reseller_withdrawal(UUID);
CREATE FUNCTION pay_reseller_withdrawal(
  p_withdrawal_id UUID
)
RETURNS TABLE (reseller_id UUID, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller UUID;
  v_amount   NUMERIC;
BEGIN
  UPDATE withdrawal_requests
     SET status = 'paid',
         paid_at = NOW()
   WHERE id = p_withdrawal_id
     AND status IN ('pending', 'processing')
  RETURNING withdrawal_requests.reseller_id, withdrawal_requests.amount
       INTO v_reseller, v_amount;

  IF v_reseller IS NULL THEN
    RAISE EXCEPTION 'withdrawal_not_found_or_already_paid';
  END IF;

  UPDATE reseller_commissions
     SET status = 'paid',
         paid_at = NOW()
   WHERE withdrawal_request_id = p_withdrawal_id;

  RETURN QUERY SELECT v_reseller, v_amount;
END;
$$;
