-- Atomic token consumption for emergency door opens.
-- Returns the consumed row's id, or NULL if no valid token exists.
-- Called from the hardware poll endpoint to eliminate the SELECT→UPDATE race.
CREATE OR REPLACE FUNCTION consume_emergency_open(p_gym_id uuid)
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
AS $$
  UPDATE emergency_opens
  SET    consumed_at = now()
  WHERE  id = (
    SELECT id
    FROM   emergency_opens
    WHERE  gym_id      = p_gym_id
      AND  consumed_at IS NULL
      AND  expires_at  > now()
    ORDER  BY created_at DESC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id;
$$;
