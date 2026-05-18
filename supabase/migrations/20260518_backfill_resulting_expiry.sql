-- Backfill resulting_expiry for all historical membresia payments that have NULL.
--
-- Simulates the exact same stacking logic used in usePagoModal:
--   base = MAX(running_expiry, payment_date)
--   resulting_expiry = base + duracion_dias
--
-- Payments already with a stored resulting_expiry are left untouched and
-- advance the running chain (so the chain stays consistent).
--
-- Limitation: uses the alumno's current plan duration for all historical
-- payments. If the plan changed, earlier periods may be off by the delta
-- between old and new duration — unavoidable without storing duration per pago.
-- This is still far more accurate than Strategy B's flat date+duration fallback.

DO $$
DECLARE
  prev_alumno UUID := NULL;
  running     DATE  := NULL;
  base        DATE;
  computed    DATE;
  r           RECORD;
BEGIN
  FOR r IN (
    SELECT
      p.id,
      p.alumno_id,
      p.date::date                            AS pdate,
      p.resulting_expiry,
      COALESCE(pl.duracion_dias, 30)          AS duracion_dias
    FROM   pagos p
    JOIN   alumnos a  ON a.id  = p.alumno_id
    LEFT JOIN planes pl ON pl.id = a.plan_id
    WHERE  p.concepto = 'membresia'
      AND  p.status   = 'validado'
    ORDER BY p.alumno_id, p.date, p.created_at
  ) LOOP
    -- Reset chain for each new alumno
    IF r.alumno_id IS DISTINCT FROM prev_alumno THEN
      running      := NULL;
      prev_alumno  := r.alumno_id;
    END IF;

    -- Payment already has resulting_expiry: advance running chain, skip update
    IF r.resulting_expiry IS NOT NULL THEN
      running := GREATEST(running, r.resulting_expiry);
      CONTINUE;
    END IF;

    -- Stacking: base = MAX(prev chain expiry, this payment date)
    base     := GREATEST(running, r.pdate);
    computed := base + r.duracion_dias;

    UPDATE pagos
    SET    resulting_expiry = computed
    WHERE  id = r.id;

    running := computed;
  END LOOP;
END;
$$;
