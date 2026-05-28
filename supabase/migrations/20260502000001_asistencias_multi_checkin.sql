-- Permite múltiples check-ins por alumno por día (ej: turno mañana y tarde)
ALTER TABLE asistencias DROP CONSTRAINT IF EXISTS asistencias_alumno_id_fecha_key;
