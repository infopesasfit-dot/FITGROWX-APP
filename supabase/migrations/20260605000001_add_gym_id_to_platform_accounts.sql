-- Add gym_id to platform_accounts and backfill from auth.users + profiles
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_platform_accounts_gym_id ON platform_accounts(gym_id);

-- Backfill gym_id for existing rows using email as the bridge
UPDATE platform_accounts pa
SET gym_id = p.gym_id
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE pa.email = u.email
  AND pa.gym_id IS NULL;
