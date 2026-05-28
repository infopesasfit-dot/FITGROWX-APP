ALTER TABLE alumnos
  ADD COLUMN IF NOT EXISTS frozen_since date,
  ADD COLUMN IF NOT EXISTS pausa_hasta  date;

CREATE INDEX IF NOT EXISTS alumnos_pausa_hasta_idx ON alumnos(pausa_hasta) WHERE status = 'pausado';
