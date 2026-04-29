ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS landing_template TEXT    DEFAULT 'energia',
  ADD COLUMN IF NOT EXISTS landing_subtitle TEXT,
  ADD COLUMN IF NOT EXISTS landing_cta_text TEXT    DEFAULT 'Quiero mi clase gratis →',
  ADD COLUMN IF NOT EXISTS landing_benefits JSONB   DEFAULT '[]';
