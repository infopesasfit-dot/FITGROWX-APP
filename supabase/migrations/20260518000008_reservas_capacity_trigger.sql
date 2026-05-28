-- Trigger que enforcea max_capacity en reservas ANTES de insertar.
-- Corre dentro de la misma transacción → no hay race condition.

CREATE OR REPLACE FUNCTION check_reserva_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_max   int;
  v_count int;
BEGIN
  -- Solo aplica a inserts con estado confirmada
  IF NEW.estado IS DISTINCT FROM 'confirmada' THEN
    RETURN NEW;
  END IF;

  SELECT max_capacity INTO v_max
    FROM gym_classes WHERE id = NEW.clase_id;

  IF v_max IS NULL THEN
    RETURN NEW; -- clase no encontrada, dejar que la FK falle
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM reservas
   WHERE clase_id = NEW.clase_id
     AND fecha    = NEW.fecha
     AND estado   = 'confirmada';

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'CAPACITY_EXCEEDED' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserva_capacity ON reservas;
CREATE TRIGGER trg_reserva_capacity
  BEFORE INSERT ON reservas
  FOR EACH ROW EXECUTE FUNCTION check_reserva_capacity();
