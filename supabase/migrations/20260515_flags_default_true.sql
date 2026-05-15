-- Ensure automation flag columns exist and default to true for new gyms.
-- ADD COLUMN IF NOT EXISTS creates the column when missing;
-- ALTER COLUMN SET DEFAULT updates the default for columns that already exist.

ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS vencimiento_activo  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS inactividad_activo  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clase_gratis_activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cumple_activo       BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE gym_settings
  ALTER COLUMN vencimiento_activo  SET DEFAULT true,
  ALTER COLUMN inactividad_activo  SET DEFAULT true,
  ALTER COLUMN clase_gratis_activo SET DEFAULT true,
  ALTER COLUMN cumple_activo       SET DEFAULT true;
