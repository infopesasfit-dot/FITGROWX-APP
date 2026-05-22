-- Migración: Secure whatsapp_sessions RLS policy
-- Reemplaza la policy insegura "service_role_full_access" que permitía acceso abierto a creds_json

-- Remover política insegura que exponía creds_json a anon key
DROP POLICY IF EXISTS "service_role_full_access" ON whatsapp_sessions;

-- Asegurar RLS habilitado
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- Nueva política: denegar acceso a todos excepto service_role
-- (service_role bypassea automáticamente RLS en Supabase)
CREATE POLICY "restrict_credentials_to_service_role" ON whatsapp_sessions
  FOR ALL USING (false) WITH CHECK (false);
