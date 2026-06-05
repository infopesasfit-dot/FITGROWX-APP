-- The reseller withdrawal RPCs (20260605162722) are SECURITY DEFINER but were
-- created with the default PUBLIC execute grant, so anon/authenticated could
-- invoke them directly via PostgREST. Lock execution down to service_role only;
-- these are called exclusively from server routes using the service-role key.

REVOKE EXECUTE ON FUNCTION create_reseller_withdrawal(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION pay_reseller_withdrawal(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION create_reseller_withdrawal(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION pay_reseller_withdrawal(uuid) TO service_role;
