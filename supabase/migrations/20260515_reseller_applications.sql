CREATE TABLE IF NOT EXISTS reseller_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  whatsapp     TEXT NOT NULL,
  colleague_count TEXT,   -- "5-10", "10-20", "20+"
  social_links TEXT,      -- Instagram/TikTok/comunidad
  motivation   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
