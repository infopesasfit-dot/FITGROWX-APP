-- Agrega 'crecimiento' como valor válido en gyms.plan_type
ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_plan_type_check;

ALTER TABLE gyms ADD CONSTRAINT gyms_plan_type_check
  CHECK (plan_type IS NULL OR plan_type IN ('gestion', 'crecimiento', 'full_marca'));
