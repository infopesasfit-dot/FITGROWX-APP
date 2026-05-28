UPDATE gyms
SET plan_type = 'crecimiento'
WHERE plan_type IN ('gestion', 'full_marca');

ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_plan_type_check;

ALTER TABLE gyms ADD CONSTRAINT gyms_plan_type_check
  CHECK (plan_type IS NULL OR plan_type IN ('crecimiento'));
