-- RPC: última asistencia por alumno (evita full table scan en cron ausentes)
CREATE OR REPLACE FUNCTION last_asistencia_per_alumno(
  gym_id_input UUID,
  alumno_ids   UUID[]
)
RETURNS TABLE (alumno_id UUID, fecha DATE)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (a.alumno_id) a.alumno_id, a.fecha
  FROM asistencias a
  WHERE a.gym_id = gym_id_input
    AND a.alumno_id = ANY(alumno_ids)
  ORDER BY a.alumno_id, a.fecha DESC;
$$;
