CREATE TABLE IF NOT EXISTS platform_impersonation_tokens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_gym_id    UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  target_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token            UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  expires_at       TIMESTAMPTZ NOT NULL,
  used             BOOLEAN NOT NULL DEFAULT FALSE,
  used_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_imp_tokens_token
  ON platform_impersonation_tokens(token);

CREATE INDEX IF NOT EXISTS idx_platform_imp_tokens_platform_user
  ON platform_impersonation_tokens(platform_user_id, expires_at DESC);

ALTER TABLE platform_impersonation_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON platform_impersonation_tokens;
CREATE POLICY "service_role_all"
  ON platform_impersonation_tokens
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "platform_owner_select_own_impersonation_tokens" ON platform_impersonation_tokens;
CREATE POLICY "platform_owner_select_own_impersonation_tokens"
  ON platform_impersonation_tokens
  FOR SELECT TO authenticated
  USING (public.is_platform_owner(auth.uid()) AND platform_user_id = auth.uid());
