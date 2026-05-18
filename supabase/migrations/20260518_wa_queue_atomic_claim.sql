-- Atomic batch claim for wa_queue flush worker.
-- Prevents concurrent cron runs from processing the same messages twice.
--
-- claimed_at: set when a worker picks up the row; auto-releases after 2 min
-- so a crashed worker never permanently locks messages.

ALTER TABLE wa_queue ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE OR REPLACE FUNCTION claim_wa_queue_batch(p_batch int)
RETURNS SETOF wa_queue
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
  UPDATE wa_queue
  SET    claimed_at = now()
  WHERE  id IN (
    SELECT id
    FROM   wa_queue
    WHERE  sent_at    IS NULL
      AND  failed_at  IS NULL
      AND  (claimed_at IS NULL OR claimed_at < now() - interval '2 minutes')
      AND  scheduled_at <= now()
      AND  attempts < 3
    ORDER BY priority ASC, scheduled_at ASC
    LIMIT  p_batch
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
