-- FitGrowX — agrega 'debito' como método de pago válido
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_method_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_method_check
  CHECK (method IN ('efectivo','transferencia','mercadopago','debito'));

-- gym_settings: columnas para alias de cobro y mensaje de bienvenida
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS cobro_alias TEXT,
  ADD COLUMN IF NOT EXISTS welcome_msg TEXT;
