-- ── asistencias: registro de presencia por escaneo de QR ─────────────────────
CREATE TABLE IF NOT EXISTS asistencias (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id     UUID NOT NULL,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  hora       TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alumno_id, fecha)  -- un check-in por alumno por día
);

CREATE INDEX IF NOT EXISTS idx_asistencias_gym_id   ON asistencias(gym_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_alumno   ON asistencias(alumno_id);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha    ON asistencias(fecha);

ALTER TABLE asistencias ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asistencias' AND policyname='owner_asistencias') THEN
    CREATE POLICY "owner_asistencias" ON asistencias FOR ALL TO authenticated
      USING (gym_id = auth.uid()) WITH CHECK (gym_id = auth.uid());
  END IF;
  -- service_role puede insertar desde el checkin API (usa service key)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asistencias' AND policyname='service_asistencias') THEN
    CREATE POLICY "service_asistencias" ON asistencias FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── campos de automatización de reactivación en gym_settings ─────────────────
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS inactividad_activo  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS inactividad_dias    INT     NOT NULL DEFAULT 7;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS inactividad_msg     TEXT;
ALTER TABLE gym_settings ADD COLUMN IF NOT EXISTS magiclink_msg       TEXT;

-- ── timestamp del último mensaje de reactivación enviado a cada alumno ────────
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS ultima_notif_inactividad TIMESTAMPTZ;
