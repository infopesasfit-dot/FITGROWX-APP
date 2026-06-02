-- Re-add SELECT policies for Supabase-authenticated users (gym owners/admins).
-- Alumnos use token-based auth so all their storage ops go via service_role API routes.
-- These policies allow authenticated users to read only from folders matching their uid.

CREATE POLICY "progreso-fotos select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'progreso-fotos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "alumno-avatars select own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'alumno-avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
