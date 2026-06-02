CREATE TABLE rutina_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  objetivo TEXT,
  rutinatipo TEXT NOT NULL DEFAULT 'gym',
  ejercicios JSONB NOT NULL DEFAULT '[]',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rutina_templates_gym_id ON rutina_templates(gym_id);

ALTER TABLE rutina_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_own_templates" ON rutina_templates
  FOR ALL USING (
    gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );
