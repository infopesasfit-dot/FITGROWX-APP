-- ── alumno_tokens: magic-link tokens para acceso de alumnos ──────────────────
CREATE TABLE IF NOT EXISTS alumno_tokens (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  gym_id     UUID NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── reservas: reservas de clases por alumno ────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id     UUID NOT NULL,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  clase_id   UUID NOT NULL REFERENCES gym_classes(id) ON DELETE CASCADE,
  fecha      DATE NOT NULL,
  estado     TEXT DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alumno_id, clase_id, fecha)
);

-- ── rutinas: rutinas asignadas por el dueño a cada alumno ─────────────────────
CREATE TABLE IF NOT EXISTS rutinas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id      UUID NOT NULL,
  alumno_id   UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL DEFAULT 'Mi Rutina',
  ejercicios  JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alumno_id)
);

-- ── progreso_pesos: registro de cargas por alumno/ejercicio ───────────────────
CREATE TABLE IF NOT EXISTS progreso_pesos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id     UUID NOT NULL,
  alumno_id  UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  ejercicio  TEXT NOT NULL,
  peso       NUMERIC NOT NULL,
  fecha      DATE DEFAULT CURRENT_DATE,
  notas      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── email en alumnos (si no existe) ──────────────────────────────────────────
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS email TEXT;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE alumno_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rutinas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_pesos ENABLE ROW LEVEL SECURITY;

-- gym owner puede ver/modificar sus datos
CREATE POLICY "owner_alumno_tokens"  ON alumno_tokens  FOR ALL TO authenticated USING (gym_id = auth.uid());
CREATE POLICY "owner_reservas"       ON reservas       FOR ALL TO authenticated USING (gym_id = auth.uid());
CREATE POLICY "owner_rutinas"        ON rutinas        FOR ALL TO authenticated USING (gym_id = auth.uid());
CREATE POLICY "owner_progreso_pesos" ON progreso_pesos FOR ALL TO authenticated USING (gym_id = auth.uid());
