-- Clases del gimnasio
CREATE TABLE IF NOT EXISTS gym_classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        uuid NOT NULL,
  class_name    text NOT NULL,
  day_of_week   smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom … 6=Sáb
  start_time    time NOT NULL,
  max_capacity  int  NOT NULL DEFAULT 20,
  created_at    timestamptz DEFAULT now()
);

-- Reservas de leads
CREATE TABLE IF NOT EXISTS class_reservations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES gym_classes(id) ON DELETE CASCADE,
  lead_name   text NOT NULL,
  lead_phone  text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_gym_classes_gym_id   ON gym_classes(gym_id);
CREATE INDEX IF NOT EXISTS idx_reservations_class   ON class_reservations(class_id);

-- RLS: lectura pública para la página de reservas
ALTER TABLE gym_classes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read classes"
  ON gym_classes FOR SELECT USING (true);

CREATE POLICY "public insert reservations"
  ON class_reservations FOR INSERT WITH CHECK (true);

CREATE POLICY "public read reservations count"
  ON class_reservations FOR SELECT USING (true);
