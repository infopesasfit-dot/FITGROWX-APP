-- Storage RLS policies for progreso-fotos and alumno-avatars buckets
-- Pattern mirrors comprobantes owner read (20260507000002_rls_security_fixes.sql:150)
-- Alumnos can only read/write objects inside their own folder (alumno_id is path segment [1])

-- ── progreso-fotos ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "progreso-fotos owner select" ON storage.objects;
CREATE POLICY "progreso-fotos owner select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'progreso-fotos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "progreso-fotos owner insert" ON storage.objects;
CREATE POLICY "progreso-fotos owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'progreso-fotos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "progreso-fotos owner update" ON storage.objects;
CREATE POLICY "progreso-fotos owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'progreso-fotos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "progreso-fotos owner delete" ON storage.objects;
CREATE POLICY "progreso-fotos owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'progreso-fotos'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

-- ── alumno-avatars ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "alumno-avatars owner select" ON storage.objects;
CREATE POLICY "alumno-avatars owner select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'alumno-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alumno-avatars owner insert" ON storage.objects;
CREATE POLICY "alumno-avatars owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'alumno-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alumno-avatars owner update" ON storage.objects;
CREATE POLICY "alumno-avatars owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'alumno-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "alumno-avatars owner delete" ON storage.objects;
CREATE POLICY "alumno-avatars owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'alumno-avatars'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM alumnos WHERE user_id = auth.uid()
    )
  );
