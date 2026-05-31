CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid        NOT NULL,
  action        text        NOT NULL,
  resource_type text        NOT NULL,
  resource_id   text,
  before_state  jsonb,
  after_state   jsonb,
  meta          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pal_actor    ON platform_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_pal_resource ON platform_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_pal_created  ON platform_audit_logs(created_at DESC);

ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_owner_audit_logs" ON platform_audit_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_owner'
    )
  );
