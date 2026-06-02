CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON push_subscriptions;
CREATE POLICY "service_role_all" ON push_subscriptions
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_alumno_id
  ON push_subscriptions(alumno_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_gym_id
  ON push_subscriptions(gym_id);
