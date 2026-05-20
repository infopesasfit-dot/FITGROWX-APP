-- Migración: Persistencia de sesiones WhatsApp en Supabase
-- Ejecutá esto en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  gym_id TEXT PRIMARY KEY,
  creds_json TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_gym_id ON whatsapp_sessions(gym_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated_at ON whatsapp_sessions(updated_at);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON whatsapp_sessions
  FOR ALL USING (true) WITH CHECK (true);
