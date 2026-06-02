-- Storage RLS for progreso-fotos and alumno-avatars buckets.
-- Alumnos use token-based auth (not Supabase Auth), so auth.uid() cannot
-- resolve to an alumno row. All storage operations go through the API with
-- service_role (bypasses RLS). Drop any stale authenticated-user policies so
-- there are no dangling rules granting direct access.

DROP POLICY IF EXISTS "progreso-fotos owner select" ON storage.objects;
DROP POLICY IF EXISTS "progreso-fotos owner insert" ON storage.objects;
DROP POLICY IF EXISTS "progreso-fotos owner update" ON storage.objects;
DROP POLICY IF EXISTS "progreso-fotos owner delete" ON storage.objects;

DROP POLICY IF EXISTS "alumno-avatars owner select" ON storage.objects;
DROP POLICY IF EXISTS "alumno-avatars owner insert" ON storage.objects;
DROP POLICY IF EXISTS "alumno-avatars owner update" ON storage.objects;
DROP POLICY IF EXISTS "alumno-avatars owner delete" ON storage.objects;
