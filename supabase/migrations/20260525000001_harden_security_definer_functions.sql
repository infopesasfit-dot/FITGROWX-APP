-- Harden consume_emergency_open SECURITY DEFINER function
-- Restrict search_path to public schema only
-- Revoke public access, grant only to service_role
ALTER FUNCTION consume_emergency_open(p_gym_id uuid)
  SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION consume_emergency_open(p_gym_id uuid) FROM public;
GRANT EXECUTE ON FUNCTION consume_emergency_open(p_gym_id uuid) TO service_role;

-- Harden claim_wa_queue_batch SECURITY DEFINER function
-- Restrict search_path to public schema only
-- Revoke public access, grant only to service_role
ALTER FUNCTION claim_wa_queue_batch(p_batch integer)
  SET search_path = 'public';

REVOKE EXECUTE ON FUNCTION claim_wa_queue_batch(p_batch integer) FROM public;
GRANT EXECUTE ON FUNCTION claim_wa_queue_batch(p_batch integer) TO service_role;
