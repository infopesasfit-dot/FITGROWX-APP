-- Agrega notas del coach a rutinas
ALTER TABLE rutinas ADD COLUMN IF NOT EXISTS notas TEXT;
