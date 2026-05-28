-- ══════════════════════════════════════════════════════════════════
-- RLS Security Audit Fixes — 2026-05-07
-- ══════════════════════════════════════════════════════════════════

-- ── P0: CRÍTICOS — fugas cross-tenant ─────────────────────────────

-- 1. class_reservations: SELECT público expone lead_name + lead_phone (PII)
DROP POLICY IF EXISTS "public read reservations count" ON class_reservations;
-- El conteo de capacidad se hace via RPC (ver abajo), no SELECT directo.

-- 2. reservas: SELECT USING(true) expone todas las reservas de todos los gyms
DROP POLICY IF EXISTS "owner_reservas_anon" ON reservas;
CREATE POLICY "owner_reservas_select" ON reservas FOR SELECT TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 3. monthly_dashboard_reports: sin RLS ni políticas
ALTER TABLE monthly_dashboard_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select reports" ON monthly_dashboard_reports FOR SELECT TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "service all reports" ON monthly_dashboard_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. gyms: confirmar RLS activo
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;

-- 5. last_asistencia_per_alumno() RPC: sin control de acceso — cualquiera puede
--    consultar asistencias de cualquier gym pasando gym_id_input arbitrario.
CREATE OR REPLACE FUNCTION last_asistencia_per_alumno(gym_id_input UUID, alumno_ids UUID[])
RETURNS TABLE (alumno_id UUID, fecha DATE)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (a.alumno_id) a.alumno_id, a.fecha
  FROM asistencias a
  WHERE a.gym_id = gym_id_input
    AND a.gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
    AND a.alumno_id = ANY(alumno_ids)
  ORDER BY a.alumno_id, a.fecha DESC;
$$;

-- RPC pública para contar reservas por clase (reemplaza la policy pública eliminada)
CREATE OR REPLACE FUNCTION get_class_reservation_count(p_class_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::INT FROM class_reservations WHERE class_id = p_class_id;
$$;

-- ── P1: FUNCIONAL — staff bloqueado en tablas clave ───────────────

-- 6. gym_settings: reemplazar auth.uid() por subquery para que staff también acceda
DROP POLICY IF EXISTS "owner_gym_settings" ON gym_settings;
DROP POLICY IF EXISTS "gym_owner_select" ON gym_settings;
DROP POLICY IF EXISTS "gym_owner_insert" ON gym_settings;
DROP POLICY IF EXISTS "gym_owner_update" ON gym_settings;
DROP POLICY IF EXISTS "gym_owner_delete" ON gym_settings;

CREATE POLICY "gym_member_select" ON gym_settings FOR SELECT TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_insert" ON gym_settings FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_update" ON gym_settings FOR UPDATE TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_delete" ON gym_settings FOR DELETE TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 7. leads: ídem
DROP POLICY IF EXISTS "owner_leads" ON leads;
DROP POLICY IF EXISTS "gym_owner_select" ON leads;
DROP POLICY IF EXISTS "gym_owner_insert" ON leads;
DROP POLICY IF EXISTS "gym_owner_update" ON leads;
DROP POLICY IF EXISTS "gym_owner_delete" ON leads;

CREATE POLICY "gym_member_select" ON leads FOR SELECT TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_insert" ON leads FOR INSERT TO authenticated
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_update" ON leads FOR UPDATE TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "gym_member_delete" ON leads FOR DELETE TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 8. alumno_tokens: ídem
DROP POLICY IF EXISTS "owner_alumno_tokens" ON alumno_tokens;
CREATE POLICY "gym_member_all" ON alumno_tokens FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 9. rutinas: ídem
DROP POLICY IF EXISTS "owner_rutinas" ON rutinas;
CREATE POLICY "gym_member_all" ON rutinas FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 10. progreso_pesos: ídem
DROP POLICY IF EXISTS "owner_progreso_pesos" ON progreso_pesos;
CREATE POLICY "gym_member_all" ON progreso_pesos FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 11. notifications: ídem + agregar DELETE
DROP POLICY IF EXISTS "owner_notifications" ON notifications;
DROP POLICY IF EXISTS "gym_owner_select" ON notifications;
DROP POLICY IF EXISTS "gym_owner_insert" ON notifications;
DROP POLICY IF EXISTS "gym_owner_update" ON notifications;

CREATE POLICY "gym_member_all" ON notifications FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 12. membresias: conflicto owner_all usa auth.uid() directo, bloquea staff
DROP POLICY IF EXISTS "owner_all" ON membresias;
CREATE POLICY "gym_member_all" ON membresias FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 13. asistencias: corregir política original si aún existe con auth.uid() directo
DROP POLICY IF EXISTS "owner_asistencias" ON asistencias;
CREATE POLICY "gym_member_asistencias" ON asistencias FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

-- 14. gym_classes (gestión interna): staff debe poder gestionar clases
DROP POLICY IF EXISTS "owner_gym_classes" ON gym_classes;
CREATE POLICY "gym_member_manage" ON gym_classes FOR ALL TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));
-- La policy pública de lectura se mantiene para la landing page:
-- "public read classes" USING (true) ya existe — no se toca.

-- 15. whatsapp_sessions: agregar DELETE
DROP POLICY IF EXISTS "owner delete whatsapp_sessions" ON whatsapp_sessions;
CREATE POLICY "owner delete whatsapp_sessions" ON whatsapp_sessions FOR DELETE TO authenticated
  USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())::text);

-- 16. profiles: verificar que INSERT y UPDATE existen (pueden haberse perdido en 20260502)
DROP POLICY IF EXISTS "users insert own profile" ON profiles;
DROP POLICY IF EXISTS "users update own profile" ON profiles;
CREATE POLICY "users insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "users update own profile" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ── P2: HARDENING ─────────────────────────────────────────────────

-- 17. prospectos: validar que gym_id referencia un gym real (evita spam cross-tenant)
DROP POLICY IF EXISTS "public insert prospectos" ON prospectos;
CREATE POLICY "public insert prospectos" ON prospectos FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM gym_settings WHERE gym_id = prospectos.gym_id)
  );

-- 18. Storage comprobantes: restringir lectura al gym dueño del archivo
DROP POLICY IF EXISTS "comprobantes public read" ON storage.objects;
CREATE POLICY "comprobantes owner read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = (
      SELECT gym_id::text FROM profiles WHERE id = auth.uid()
    )
  );
