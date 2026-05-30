-- Widen gyms.gym_status CHECK to include 'cancelled'.
-- The MP webhook (preapproval cancelled/paused) sets gym_status to a cancelled
-- state. Previously it used the invalid value 'inactive', which violated the
-- CHECK constraint and made the entire downgrade UPDATE fail silently — gyms
-- that cancelled in MP or whose recurring payment failed kept full access.

ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_gym_status_check;

ALTER TABLE gyms ADD CONSTRAINT gyms_gym_status_check
  CHECK (gym_status IN ('trial', 'active', 'trial_expired', 'cancelled'));
