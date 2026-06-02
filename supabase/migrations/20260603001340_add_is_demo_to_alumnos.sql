ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alumnos_demo_gym
  ON alumnos(gym_id) WHERE is_demo = true;
