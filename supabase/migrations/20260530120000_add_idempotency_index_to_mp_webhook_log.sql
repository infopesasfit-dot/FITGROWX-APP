-- Validate mp_webhook_log has no existing duplicates in terminal states before creating index.
DO $$
DECLARE dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT payment_id, event_type
    FROM mp_webhook_log
    WHERE payment_id IS NOT NULL
      AND status NOT IN ('received', 'error', 'ignored')
    GROUP BY payment_id, event_type
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index: % duplicate (payment_id, event_type) pairs exist in mp_webhook_log with terminal status',
      dup_count;
  END IF;
END $$;

-- Partial unique index: only one row per (payment_id, event_type) in active states.
-- 'received', 'error', 'ignored' are excluded and can repeat freely.
-- This is the DB-level gate that makes concurrent duplicate webhooks race on INSERT
-- and ensures only one wins — the rest get error code 23505 and return 200 immediately.
CREATE UNIQUE INDEX IF NOT EXISTS mp_webhook_log_idempotency
  ON mp_webhook_log (payment_id, event_type)
  WHERE payment_id IS NOT NULL
    AND status NOT IN ('received', 'error', 'ignored');

-- Validate reseller_commissions has no duplicate mp_payment_ref before creating index.
DO $$
DECLARE dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT mp_payment_ref FROM reseller_commissions
    WHERE mp_payment_ref IS NOT NULL
    GROUP BY mp_payment_ref HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index: % duplicate mp_payment_ref values in reseller_commissions',
      dup_count;
  END IF;
END $$;

-- Required for upsert({ onConflict: "mp_payment_ref" }) in createResellerCommission
-- to actually enforce idempotency. Without this constraint PostgREST silently inserts duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS reseller_commissions_mp_payment_ref_unique
  ON reseller_commissions (mp_payment_ref)
  WHERE mp_payment_ref IS NOT NULL;
