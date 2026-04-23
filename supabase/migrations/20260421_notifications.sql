CREATE TABLE IF NOT EXISTS notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gym_id     UUID NOT NULL,
  type       TEXT NOT NULL,  -- 'new_alumno' | 'new_payment' | 'new_prospecto'
  title      TEXT NOT NULL,
  body       TEXT,
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_gym_id_created ON notifications(gym_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_owner_select" ON notifications
  FOR SELECT USING (gym_id = auth.uid());

CREATE POLICY "gym_owner_insert" ON notifications
  FOR INSERT WITH CHECK (gym_id = auth.uid());

CREATE POLICY "gym_owner_update" ON notifications
  FOR UPDATE USING (gym_id = auth.uid());
