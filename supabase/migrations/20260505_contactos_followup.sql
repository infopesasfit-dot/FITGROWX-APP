-- contactos_step: 0=llegó, 1=día-0 enviado, 2=día-1 enviado, 3=done
ALTER TABLE prospectos
  ADD COLUMN IF NOT EXISTS contactos_step INT NOT NULL DEFAULT 0;

-- message templates for Nuevos Contactos
ALTER TABLE gym_settings
  ADD COLUMN IF NOT EXISTS contactos_msg_0 TEXT,
  ADD COLUMN IF NOT EXISTS contactos_msg_1 TEXT,
  ADD COLUMN IF NOT EXISTS contactos_msg_3 TEXT;
