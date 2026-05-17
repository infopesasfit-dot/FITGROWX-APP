-- Nuevo estado: clase cancelada por el gimnasio (devuelve el crédito automáticamente)

ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_estado_check;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('confirmada', 'cancelada', 'cancelada_tarde', 'clase_cancelada_gym'));

-- El índice de cuota semanal NO incluye clase_cancelada_gym → el crédito se devuelve solo
-- (no hace falta recrearlo, ya filtra solo confirmada + cancelada_tarde)
