-- Bloquea DELETE en planes si hay alumnos activos asignados.
-- Protege contra borrados directos desde Supabase dashboard o cualquier cliente.
CREATE OR REPLACE FUNCTION check_plan_no_active_alumnos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM alumnos
  WHERE plan_id = OLD.id AND status = 'activo';

  IF cnt > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar un plan con % alumno(s) activo(s) asignado(s).', cnt;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER planes_no_delete_with_active_alumnos
  BEFORE DELETE ON planes
  FOR EACH ROW EXECUTE FUNCTION check_plan_no_active_alumnos();
