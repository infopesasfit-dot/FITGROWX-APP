-- ── wa_queue ──────────────────────────────────────────────────────────────────
-- gym_id (uuid) is matched against profiles.gym_id for the authenticated user.
-- service_role bypasses RLS by default (cron flush worker, claim function, etc.)
-- claim_wa_queue_batch() is SECURITY DEFINER so it is unaffected.

ALTER TABLE wa_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_queue_gym_owner"
  ON wa_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.gym_id = wa_queue.gym_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.gym_id = wa_queue.gym_id
    )
  );

-- ── mp_webhook_log ────────────────────────────────────────────────────────────
-- gym_id is text (cast needed). Gyms may only read their own rows.
-- All writes come from service_role (webhook handlers), which bypasses RLS.

ALTER TABLE mp_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_webhook_log_gym_read"
  ON mp_webhook_log
  FOR SELECT
  USING (
    gym_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.gym_id::text = mp_webhook_log.gym_id
    )
  );
