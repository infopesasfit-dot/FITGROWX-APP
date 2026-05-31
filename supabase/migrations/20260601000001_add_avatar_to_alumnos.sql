ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alumno-avatars',
  'alumno-avatars',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
