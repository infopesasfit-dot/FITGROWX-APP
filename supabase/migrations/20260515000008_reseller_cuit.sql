ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS cuit TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_condition TEXT DEFAULT 'pendiente';
-- fiscal_condition: pendiente | monotributo | responsable_inscripto
