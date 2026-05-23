# Audit: April 27, 2026 Migration Backlog

**Date:** 2026-05-24  
**Status:** OBSOLETE — Safe to archive  
**Decision:** Do NOT apply to production

## Summary

The 837-line backlog migration (20260427_manual_migrations_backlog.sql) was intended to catch up with schema drift accumulated between 2026-04-27 and when migrations were formalized. 

**Verification Result:** ~99% redundant. All objects exist in production with matching definitions.

---

## Detailed Findings

### ✅ Tables (All Exist)
- asistencias ✓
- egresos ✓
- gym_cuentas ✓
- gym_promotions ✓
- membresias ✓
- monthly_dashboard_reports ✓
- prospectos ✓
- staff_payment_reminders ✓
- wa_contact_metrics ✓
- wa_gym_rate_limits ✓
- wa_mensajes_log ✓
- wa_motor_events ✓
- wa_platform_metrics ✓
- whatsapp_sessions ✓

### ✅ Columns (All Exist)
**alumnos:** whatsapp_opted_in, phone_is_invalid, notif_vencimiento_para, whatsapp_opted_in_at, phone_invalid_at  
**gym_settings:** wa_status, wa_phone, wa_battery, wa_plugged, wa_signal, instagram_url, onboarding_completed, lead_auto_welcome, vencimiento_activo, vencimiento_dias, vencimiento_msg, staff_payment_reminder_enabled, staff_payment_reminder_days, staff_payment_reminder_day_of_week, last_staff_payment_reminder_sent_at, last_staff_payment_registered_at  
**planes:** duracion_dias, active, access_type, classes_per_week  
**pagos:** method, status, concepto, descripcion, comprobante_url, notes, validated_by  
**wa_mensajes_log:** alumno_id, alumno_name, status, latency_ms, motor_status_code, motor_error  

### ✅ Indices (All Exist)
14 indices across all tables match migration definition exactly.

### ✅ Functions (All Exist)
- check_gym_wa_rate_limit ✓
- update_wa_contact_metrics_after_send ✓
- mark_wa_contact_blocked ✓
- update_staff_payment_timestamp ✓

### ✅ Triggers (All Exist)
- trg_update_wa_contact_metrics ✓
- trg_mark_wa_contact_blocked ✓
- trigger_staff_payment_timestamp ✓

### ✅ Views (All Exist with security_invoker=true)
- alumnos_para_recordatorio ✓
- alumnos_vencidos ✓
- alumnos_sin_pago_reciente ✓

### ✅ Policies (All Exist)
Across asistencias, profiles, gym_promotions, egresos, membresias, prospectos — all match definitions.

### ✅ Grants (All Exist)
- wa_contact_metrics: SELECT (postgres, authenticated), INSERT/UPDATE (postgres, authenticated) ✓
- wa_platform_metrics: SELECT (postgres, authenticated) ✓
- staff_payment_reminders: SELECT/INSERT/UPDATE (postgres, authenticated) ✓

---

## ⚠️ Real Drift Found (Non-Critical)

### 1. Missing Constraint: `gym_promotions_type_check`
- **Location:** gym_promotions table
- **Expected:** CHECK (promo_type IN ('descuento', 'referido', '2x1'))
- **Actual:** NOT FOUND in production
- **Impact:** LOW — table is empty; no active promotions in schema
- **Used by:** app/dashboard/membresias/page.tsx (actively queries gym_promotions)
- **Recommendation:** Can be added manually later if promotions feature is activated

### 2. Obsolete Data Migration: `plan_type` Consolidation
- **Location:** Lines 222-229
- **What it does:** UPDATE gyms SET plan_type = 'crecimiento', then redefine constraint to CHECK (plan_type IS NULL OR plan_type IN ('crecimiento'))
- **Why obsolete:** Current codebase supports 'starter' plan (seen in FITGROWX_PLANS), which is NOT in the constraint
- **Impact:** MEDIUM if applied — would break 'starter' plan type
- **Recommendation:** DO NOT APPLY; constraint would need refresh

---

## Why Archive Instead of Apply?

1. **Idempotent but pointless** — IF NOT EXISTS patterns mean no-op execution
2. **Bloat** — 837 lines for zero schema advancement
3. **Risk** — plan_type constraint is now out of sync with actual plans
4. **Clarity** — Git history is cleaner if we document and archive rather than re-run

---

## Next Steps

- ✅ Archive backlog to docs/archive/
- ✅ Log findings in this document
- ⏳ If gym_promotions feature activates: manually add `gym_promotions_type_check` constraint
- ⏳ If plan_type constraint needs updating: do it explicitly with clear reasoning

---

## Audit Script

See `audit_backlog_20260427.sql` for the verification queries used to generate these findings.
