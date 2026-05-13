-- Reseller accounts
CREATE TABLE IF NOT EXISTS resellers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,    -- link: /start?reseller=SLUG
  commission_pct  NUMERIC DEFAULT 20,      -- % of each gym's monthly payment
  tier            TEXT NOT NULL DEFAULT 'standard', -- standard | premium | franchise
  status          TEXT NOT NULL DEFAULT 'active',   -- active | paused | inactive
  payout_info     TEXT,                   -- CBU/alias para transferencia de comisiones
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Link gyms to their reseller
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES resellers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_gyms_reseller ON gyms(reseller_id);

-- Commission ledger — one row per gym payment
CREATE TABLE IF NOT EXISTS reseller_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id       UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  gym_id            UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  mp_payment_ref    TEXT,                 -- payment id or preapproval id from MP
  payment_amount    NUMERIC NOT NULL,
  commission_pct    NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  payment_type      TEXT DEFAULT 'monthly', -- monthly | annual
  period_month      TEXT,                 -- "2026-05"
  status            TEXT NOT NULL DEFAULT 'pending', -- pending | paid | cancelled
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_reseller ON reseller_commissions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_commissions_gym      ON reseller_commissions(gym_id);

ALTER TABLE reseller_commissions ENABLE ROW LEVEL SECURITY;
