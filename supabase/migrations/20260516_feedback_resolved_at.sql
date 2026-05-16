-- Agrega resolved_at a platform_feedback para marcar mensajes respondidos
ALTER TABLE platform_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE platform_feedback ADD COLUMN IF NOT EXISTS resolved_by TEXT DEFAULT NULL;
