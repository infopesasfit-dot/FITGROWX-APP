-- ── Platform WA Automations ───────────────────────────────────
-- Tabla de plantillas editables por el owner + tracking de envíos
-- Idempotente: usa IF NOT EXISTS en todo.

-- 1. Plantillas de mensajes de la plataforma
CREATE TABLE IF NOT EXISTS platform_wa_templates (
  key        TEXT PRIMARY KEY,          -- 'bienvenida' | 'trial_vence' | 'reactivacion' | 'inactivo_7d'
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: solo service_role puede leer/escribir (las API routes usan admin client)
ALTER TABLE platform_wa_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_wa_templates' AND policyname = 'service only'
  ) THEN
    CREATE POLICY "service only" ON platform_wa_templates FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Valores por defecto (ON CONFLICT DO NOTHING → no pisa ediciones futuras)
INSERT INTO platform_wa_templates (key, body) VALUES
  ('bienvenida',    '¡Hola {nombre}! 🎉 Bienvenido a FitGrowX. Tu gym ya está listo para escalar. Si tenés alguna duda, respondé este mensaje.'),
  ('trial_vence',   '¡Hola {nombre}! ⏰ Tu período de prueba de FitGrowX vence en {dias} días. ¿Querés seguir creciendo? Hablemos para activar tu plan.'),
  ('reactivacion',  '¡Hola {nombre}! 👋 Hace un tiempo que no te vemos por FitGrowX. ¿Todo bien con el gym? Estamos acá para ayudarte.'),
  ('inactivo_7d',   'Ey {nombre}! Eli de FitGrowX. ¿Cómo va el gym? ¿Pudieron arrancar a usar el sistema o todavía están poniéndolo a punto? Cualquier cosa me avisás 🙌'),
  ('activacion_d3', 'Ey {nombre}! Eli de FitGrowX 👋 ¿Pudiste arrancar a cargar tus alumnos? Si querés te muestro cómo hacerlo en 5 minutos, es más fácil de lo que parece.'),
  ('trial_expirado','Hola {nombre}! Tu prueba de FitGrowX venció hoy. Tus datos siguen guardados. Si querés seguir usándolo, hablemos ahora y lo resolvemos 🙌'),
  ('primer_pago',   '🎉 {nombre}, tu gym acaba de recibir su primer pago en FitGrowX. Así se empieza a escalar. Cualquier cosa estamos acá.')
ON CONFLICT (key) DO NOTHING;

-- 2. Columnas de tracking en platform_accounts para evitar duplicados
ALTER TABLE platform_accounts
  ADD COLUMN IF NOT EXISTS wa_bienvenida_sent_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_trial_vence_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_inactivo_notif_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_activacion_d3_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_trial_expirado_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wa_primer_pago_sent_at    TIMESTAMPTZ;
