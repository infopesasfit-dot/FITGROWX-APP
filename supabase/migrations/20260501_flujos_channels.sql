-- Channels that are toggled in the Flujos de Mensajes canvas
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS canal_maps_activo  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canal_ref_activo   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bienvenida_activo  BOOLEAN NOT NULL DEFAULT TRUE;
