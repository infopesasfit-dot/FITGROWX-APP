-- Amplía el guard de borrado de planes para proteger alumnos en cualquier status,
-- no solo activos. Evita perder la referencia histórica del plan en vencidos/pausados.
CREATE OR REPLACE FUNCTION check_plan_no_active_alumnos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM alumnos
  WHERE plan_id = OLD.id
    AND status IN ('activo', 'vencido', 'pausado', 'pendiente');

  IF cnt > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar un plan con % alumno(s) asignado(s).', cnt;
  END IF;
  RETURN OLD;
END;
$$;
