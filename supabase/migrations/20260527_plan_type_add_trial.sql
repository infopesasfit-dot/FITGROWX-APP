-- ============================================================
-- Plan Type: Agregar 'trial' como opción válida
-- Cambiar default a 'trial' para nuevos gyms
-- ============================================================

-- Actualizar constraint para permitir 'trial', 'starter', 'crecimiento'
ALTER TABLE gyms DROP CONSTRAINT IF EXISTS gyms_plan_type_check;
ALTER TABLE gyms ADD CONSTRAINT gyms_plan_type_check
  CHECK (plan_type IS NULL OR plan_type IN ('trial', 'starter', 'crecimiento'));

-- Cambiar default a 'trial' para nuevos gyms
ALTER TABLE gyms ALTER COLUMN plan_type SET DEFAULT 'trial';

-- Actualizar los 8 gyms actuales de 'starter' a 'trial'
UPDATE gyms SET plan_type = 'trial' WHERE plan_type = 'starter';
