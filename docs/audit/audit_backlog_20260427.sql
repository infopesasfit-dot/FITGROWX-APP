-- ════════════════════════════════════════════════════════════════════════════════
-- AUDIT: Backlog de abril (20260427) — Verificación de DEFINICIÓN exacta
-- Compara schema actual vs lo que la migración va a aplicar
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1. COLUMNAS: Tipo, nullable, default (ASISTENCIAS) ──────────────────────────
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'asistencias'
ORDER BY ordinal_position;
-- EXPECTED: id (UUID, NOT NULL, gen_random_uuid()), gym_id (UUID, NOT NULL, null),
--           alumno_id (UUID, NOT NULL, null), fecha (DATE, NOT NULL, CURRENT_DATE),
--           hora (TIME, NOT NULL, CURRENT_TIME), created_at (TIMESTAMPTZ, null, NOW())

-- ── 2. COLUMNAS: alumnos (whatsapp_opted_in, phone_is_invalid, notif_vencimiento_para) ──
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'alumnos' AND column_name IN ('whatsapp_opted_in', 'phone_is_invalid', 'notif_vencimiento_para', 'whatsapp_opted_in_at', 'phone_invalid_at')
ORDER BY column_name;
-- EXPECTED: whatsapp_opted_in (BOOLEAN, null, true), whatsapp_opted_in_at (TIMESTAMP WITH TIME ZONE, null, NOW()),
--           phone_is_invalid (BOOLEAN, null, false), phone_invalid_at (TIMESTAMP WITH TIME ZONE, null, null),
--           notif_vencimiento_para (DATE, null, null)

-- ── 3. COLUMNAS: gym_settings (WA + staff payment + suscripción) ──────────────────
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'gym_settings' AND column_name IN (
  'wa_status', 'wa_phone', 'wa_battery', 'wa_plugged', 'wa_signal', 'instagram_url', 'onboarding_completed',
  'lead_auto_welcome', 'vencimiento_activo', 'vencimiento_dias', 'vencimiento_msg',
  'staff_payment_reminder_enabled', 'staff_payment_reminder_days', 'staff_payment_reminder_day_of_week',
  'last_staff_payment_reminder_sent_at', 'last_staff_payment_registered_at'
)
ORDER BY column_name;

-- ── 4. COLUMNAS: planes (duracion_dias, active, access_type, classes_per_week) ──
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planes' AND column_name IN ('duracion_dias', 'active', 'access_type', 'classes_per_week')
ORDER BY column_name;
-- EXPECTED: duracion_dias (INT, NOT NULL, 30), active (BOOLEAN, NOT NULL, true),
--           access_type (TEXT, NOT NULL, 'libre'), classes_per_week (INT, null, null)

-- ── 5. COLUMNAS: pagos (method, status, concepto, descripcion, comprobante_url, notes, validated_by) ──
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pagos' AND column_name IN ('method', 'status', 'concepto', 'descripcion', 'comprobante_url', 'notes', 'validated_by')
ORDER BY column_name;

-- ── 6. COLUMNAS: wa_mensajes_log (alumno_id, alumno_name, status, latency_ms, motor_status_code, motor_error) ──
SELECT
  column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'wa_mensajes_log' AND column_name IN ('alumno_id', 'alumno_name', 'status', 'latency_ms', 'motor_status_code', 'motor_error')
ORDER BY column_name;

-- ── 7. POLICIES EXACTAS: asistencias ───────────────────────────────────────────
SELECT
  policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'asistencias'
ORDER BY policyname;
-- EXPECTED:
--   owner_asistencias: FOR ALL, USING: gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
--   service_asistencias: FOR ALL, USING: true, WITH CHECK: true
--   gym_member_asistencias: (if exists)

-- ── 8. POLICIES EXACTAS: profiles ──────────────────────────────────────────────
SELECT
  policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
-- EXPECTED: users read own profile, users insert own profile, users update own profile,
--           admin reads gym profiles con la lógica de SELECT con gym_id y role check

-- ── 9. POLICIES EXACTAS: gym_promotions ────────────────────────────────────────
SELECT
  policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'gym_promotions'
ORDER BY policyname;
-- EXPECTED: owner select gym promotions, owner upsert gym promotions

-- ── 10. GRANTS: wa_contact_metrics, wa_platform_metrics, staff_payment_reminders ──
-- NOTE: Migración define GRANT (no policies) sobre estas tablas
SELECT
  grantee, privilege_type, is_grantable, table_name
FROM information_schema.role_table_grants
WHERE table_name IN ('wa_contact_metrics', 'wa_platform_metrics', 'staff_payment_reminders')
ORDER BY table_name, grantee, privilege_type;
-- EXPECTED:
--   wa_contact_metrics: SELECT (postgres, authenticated), INSERT, UPDATE (postgres, authenticated)
--   wa_platform_metrics: SELECT (postgres, authenticated)
--   staff_payment_reminders: SELECT, INSERT, UPDATE (postgres, authenticated)

-- ── 11. INDICES: Definición completa ───────────────────────────────────────────
SELECT
  schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('asistencias', 'gym_promotions', 'egresos', 'gym_cuentas', 'membresias',
                     'prospectos', 'wa_gym_rate_limits', 'wa_motor_events', 'wa_mensajes_log',
                     'wa_contact_metrics', 'staff_payment_reminders', 'monthly_dashboard_reports')
AND (
  indexname LIKE 'idx_%'
  OR indexname LIKE 'gym_%'
  OR indexname LIKE 'wa_%'
)
ORDER BY tablename, indexname;
-- Check que existan TODOS los índices definidos en la migración

-- ── 12. CONSTRAINTS: CHECK en planes (access_type) y gym_promotions (promo_type, discount_type) ────
SELECT
  tc.constraint_name,
  tc.constraint_type,
  tc.table_name,
  pg_get_constraintdef(c.oid) as definition
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
JOIN pg_class cl ON cl.oid = c.conrelid AND cl.relname = tc.table_name
WHERE tc.table_schema = 'public'
AND (
  (tc.table_name = 'planes' AND tc.constraint_name LIKE '%access_type%')
  OR (tc.table_name = 'gym_promotions' AND (tc.constraint_name LIKE '%promo_type%' OR tc.constraint_name LIKE '%discount_type%'))
  OR (tc.table_name = 'pagos' AND (tc.constraint_name LIKE '%method%' OR tc.constraint_name LIKE '%status%' OR tc.constraint_name LIKE '%concepto%'))
)
ORDER BY tc.table_name, tc.constraint_name;

-- ── 13. FUNCTIONS: Signature, SECURITY setting, search_path ──────────────────────
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as return_type,
  p.prosecdef as security_definer,
  p.proconfig as config_settings,
  p.prosrc
FROM pg_proc p
WHERE p.proname IN ('check_gym_wa_rate_limit', 'update_wa_contact_metrics_after_send', 'mark_wa_contact_blocked', 'update_staff_payment_timestamp')
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY p.proname;
-- EXPECTED:
--   check_gym_wa_rate_limit(p_gym_id UUID, p_limit INTEGER DEFAULT 100) RETURNS TABLE, security_definer=false
--   update_wa_contact_metrics_after_send() RETURNS TRIGGER, security_definer=false
--   mark_wa_contact_blocked() RETURNS TRIGGER, security_definer=false
--   update_staff_payment_timestamp() RETURNS TRIGGER, security_definer=false

-- ── 14. TRIGGERS: Nombre, función asociada, evento ─────────────────────────────
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('trg_update_wa_contact_metrics', 'trg_mark_wa_contact_blocked', 'trigger_staff_payment_timestamp')
ORDER BY trigger_name;
-- EXPECTED:
--   trg_update_wa_contact_metrics: wa_mensajes_log, AFTER INSERT, calls update_wa_contact_metrics_after_send()
--   trg_mark_wa_contact_blocked: wa_mensajes_log, AFTER INSERT, calls mark_wa_contact_blocked()
--   trigger_staff_payment_timestamp: egresos, AFTER INSERT, calls update_staff_payment_timestamp()

-- ── 15. VIEWS: Definición + security_invoker setting ──────────────────────────
SELECT
  c.relname as view_name,
  c.reloptions,
  pg_get_viewdef(c.oid, true) as definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
AND n.nspname = 'public'
AND c.relname IN ('alumnos_para_recordatorio', 'alumnos_vencidos', 'alumnos_sin_pago_reciente')
ORDER BY c.relname;
-- EXPECTED: reloptions MUST contain "security_invoker=true" (appears as ARRAY['security_invoker=true'])
-- DEFINITION: verify JOIN and WHERE clauses match migration

-- ── RESUMEN: Contar objetos redundantes vs nuevos ────────────────────────────────
SELECT
  'asistencias' as objname, COUNT(*) as count FROM pg_tables WHERE tablename='asistencias'
UNION ALL SELECT 'gym_promotions', COUNT(*) FROM pg_tables WHERE tablename='gym_promotions'
UNION ALL SELECT 'egresos', COUNT(*) FROM pg_tables WHERE tablename='egresos'
UNION ALL SELECT 'gym_cuentas', COUNT(*) FROM pg_tables WHERE tablename='gym_cuentas'
UNION ALL SELECT 'membresias', COUNT(*) FROM pg_tables WHERE tablename='membresias'
UNION ALL SELECT 'prospectos', COUNT(*) FROM pg_tables WHERE tablename='prospectos'
UNION ALL SELECT 'wa_gym_rate_limits', COUNT(*) FROM pg_tables WHERE tablename='wa_gym_rate_limits'
UNION ALL SELECT 'wa_motor_events', COUNT(*) FROM pg_tables WHERE tablename='wa_motor_events'
UNION ALL SELECT 'wa_mensajes_log', COUNT(*) FROM pg_tables WHERE tablename='wa_mensajes_log'
UNION ALL SELECT 'wa_contact_metrics', COUNT(*) FROM pg_tables WHERE tablename='wa_contact_metrics'
UNION ALL SELECT 'wa_platform_metrics', COUNT(*) FROM pg_tables WHERE tablename='wa_platform_metrics'
UNION ALL SELECT 'staff_payment_reminders', COUNT(*) FROM pg_tables WHERE tablename='staff_payment_reminders'
UNION ALL SELECT 'monthly_dashboard_reports', COUNT(*) FROM pg_tables WHERE tablename='monthly_dashboard_reports'
UNION ALL SELECT 'functions (4)', (SELECT COUNT(*) FROM pg_proc WHERE proname IN ('check_gym_wa_rate_limit', 'update_wa_contact_metrics_after_send', 'mark_wa_contact_blocked', 'update_staff_payment_timestamp') AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
UNION ALL SELECT 'triggers (3)', (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name IN ('trg_update_wa_contact_metrics', 'trg_mark_wa_contact_blocked', 'trigger_staff_payment_timestamp'))
UNION ALL SELECT 'views (3)', (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'v' AND n.nspname = 'public' AND c.relname IN ('alumnos_para_recordatorio', 'alumnos_vencidos', 'alumnos_sin_pago_reciente'));
