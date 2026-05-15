-- ============================================================
-- FitGrowX — Anulación de pagos + resulting_expiry
-- ============================================================

-- 1. Columna resulting_expiry: fecha de vencimiento resultante después de aplicar este pago.
--    Permite recalcular el vencimiento del alumno al anular el pago más reciente.
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS resulting_expiry date;

-- 2. Extender constraint de status para incluir 'anulado'.
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_status_check;
ALTER TABLE pagos
  ADD CONSTRAINT pagos_status_check
  CHECK (status IN ('pendiente', 'validado', 'rechazado', 'anulado'));

-- 3. Índice para que la query de rollback sea rápida.
CREATE INDEX IF NOT EXISTS pagos_alumno_status_expiry
  ON pagos (alumno_id, status, resulting_expiry DESC)
  WHERE concepto = 'membresia';
