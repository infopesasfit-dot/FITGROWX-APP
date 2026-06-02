-- Add cancelled_at column for commission cancellation tracking.
ALTER TABLE reseller_commissions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Replace partial unique index with a formal UNIQUE constraint.
-- The index from 20260530 was WHERE mp_payment_ref IS NOT NULL; Postgres UNIQUE constraints
-- already allow multiple NULLs natively, so behaviour is identical but enforcement is formal.
DROP INDEX IF EXISTS reseller_commissions_mp_payment_ref_unique;

ALTER TABLE reseller_commissions
  ADD CONSTRAINT uq_reseller_commissions_payment_ref UNIQUE (mp_payment_ref);
