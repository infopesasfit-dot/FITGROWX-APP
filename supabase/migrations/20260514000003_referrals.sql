-- Sistema de referidos: ref_code por gym + tabla de referidos

ALTER TABLE platform_accounts ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  referred_gym_id UUID REFERENCES gyms(id) ON DELETE SET NULL,
  referred_email  TEXT,
  code            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'registered',  -- 'registered' | 'rewarded'
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_code            ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_gym    ON referrals(referred_gym_id) WHERE referred_gym_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_gym    ON referrals(referrer_gym_id);

-- RLS: solo plataforma puede leer/escribir
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
