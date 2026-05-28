-- ============================================================
-- FitGrowX — RLS para tablas sin protección
-- Usa DO $$ para no fallar si la tabla no existe aún
-- ============================================================

DO $$ BEGIN

  -- ── egresos ────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'egresos') THEN
    EXECUTE 'ALTER TABLE egresos ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner select egresos') THEN
      CREATE POLICY "owner select egresos" ON egresos FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner insert egresos') THEN
      CREATE POLICY "owner insert egresos" ON egresos FOR INSERT
        WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner update egresos') THEN
      CREATE POLICY "owner update egresos" ON egresos FOR UPDATE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='egresos' AND policyname='owner delete egresos') THEN
      CREATE POLICY "owner delete egresos" ON egresos FOR DELETE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  -- ── prospectos ─────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prospectos') THEN
    EXECUTE 'ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='public insert prospectos') THEN
      CREATE POLICY "public insert prospectos" ON prospectos FOR INSERT
        WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner select prospectos') THEN
      CREATE POLICY "owner select prospectos" ON prospectos FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner update prospectos') THEN
      CREATE POLICY "owner update prospectos" ON prospectos FOR UPDATE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prospectos' AND policyname='owner delete prospectos') THEN
      CREATE POLICY "owner delete prospectos" ON prospectos FOR DELETE
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  -- ── membresias ─────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'membresias') THEN
    EXECUTE 'ALTER TABLE membresias ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner select membresias') THEN
      CREATE POLICY "owner select membresias" ON membresias FOR SELECT
        USING (
          alumno_id IN (
            SELECT id FROM alumnos
            WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
          )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner insert membresias') THEN
      CREATE POLICY "owner insert membresias" ON membresias FOR INSERT
        WITH CHECK (
          alumno_id IN (
            SELECT id FROM alumnos
            WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
          )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner update membresias') THEN
      CREATE POLICY "owner update membresias" ON membresias FOR UPDATE
        USING (
          alumno_id IN (
            SELECT id FROM alumnos
            WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
          )
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='membresias' AND policyname='owner delete membresias') THEN
      CREATE POLICY "owner delete membresias" ON membresias FOR DELETE
        USING (
          alumno_id IN (
            SELECT id FROM alumnos
            WHERE gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
          )
        );
    END IF;
  END IF;

  -- ── gyms — write policies (SELECT ya existe) ───────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gyms') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='gyms' AND policyname='gym updates own row') THEN
      CREATE POLICY "gym updates own row" ON gyms FOR UPDATE
        USING (id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
    END IF;
  END IF;

  -- ── profiles — write policies (SELECT ya existe) ───────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users insert own profile') THEN
      CREATE POLICY "users insert own profile" ON profiles FOR INSERT
        WITH CHECK (id = auth.uid());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profiles' AND policyname='users update own profile') THEN
      CREATE POLICY "users update own profile" ON profiles FOR UPDATE
        USING (id = auth.uid());
    END IF;
  END IF;

  -- ── whatsapp_sessions ──────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_sessions') THEN
    EXECUTE 'ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='whatsapp_sessions' AND policyname='owner select whatsapp_sessions') THEN
      CREATE POLICY "owner select whatsapp_sessions" ON whatsapp_sessions FOR SELECT
        USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);
    END IF;
  END IF;

  -- ── platform_feedback ──────────────────────────────────────
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_feedback') THEN
    EXECUTE 'ALTER TABLE platform_feedback ENABLE ROW LEVEL SECURITY';
  END IF;

END $$;
