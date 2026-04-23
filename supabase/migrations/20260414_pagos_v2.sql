-- ============================================================
-- FitGrowX — pagos v2 + gym_cuentas
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Extender tabla pagos
ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS method         TEXT    NOT NULL DEFAULT 'efectivo'
    CHECK (method IN ('efectivo','transferencia','mercadopago')),
  ADD COLUMN IF NOT EXISTS status         TEXT    NOT NULL DEFAULT 'validado'
    CHECK (status IN ('pendiente','validado','rechazado')),
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT,
  ADD COLUMN IF NOT EXISTS notes          TEXT,
  ADD COLUMN IF NOT EXISTS validated_by   UUID REFERENCES profiles(id);

-- Pagos por transferencia empiezan pendientes
-- (ya existentes quedan validados por default, que es correcto)

-- 2. Tabla de cuentas del gym
CREATE TABLE IF NOT EXISTS gym_cuentas (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id    UUID    NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  tipo      TEXT    NOT NULL CHECK (tipo IN ('alias','cbu','mercadopago')),
  valor     TEXT    NOT NULL,          -- alias, CBU o link MP
  titular   TEXT,
  banco     TEXT,
  activa    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gym_cuentas_gym_id ON gym_cuentas(gym_id);

ALTER TABLE gym_cuentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym reads own cuentas"
  ON gym_cuentas FOR SELECT
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "gym inserts own cuentas"
  ON gym_cuentas FOR INSERT
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "gym updates own cuentas"
  ON gym_cuentas FOR UPDATE
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "gym deletes own cuentas"
  ON gym_cuentas FOR DELETE
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 3. RLS update en pagos (para validación por staff)
DROP POLICY IF EXISTS "gym owner updates pagos" ON pagos;
CREATE POLICY "gym owner updates pagos"
  ON pagos FOR UPDATE
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 4. Storage bucket para comprobantes (correr también en Storage settings)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false)
-- ON CONFLICT DO NOTHING;
