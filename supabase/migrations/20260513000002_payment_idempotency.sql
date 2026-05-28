-- Idempotencia de webhooks de MercadoPago:
-- mp_payment_id como clave única evita doble-extensión de membresía en retries o webhooks simultáneos.
-- notif_pendiente_sent_at trackea cuándo se notificó al dueño sobre pagos de transferencia pendientes.

ALTER TABLE pagos
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS notif_pendiente_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_mp_payment_id_unique
  ON pagos (mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
