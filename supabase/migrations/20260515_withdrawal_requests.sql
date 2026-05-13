CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id  UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  amount       NUMERIC NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | processing | paid | rejected
  notes        TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_reseller ON withdrawal_requests(reseller_id);
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
