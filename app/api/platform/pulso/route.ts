import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdminClient();

  const now = new Date();
  const h24ago  = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const h1ago   = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const todayStr = now.toISOString().slice(0, 10);
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    // 1. WA: sesiones desconectadas / sin sesión
    waRows,
    // 2. Mensajes fallidos (logs ERROR de send-welcome en 24h)
    waMsgErrors,
    // 3. Pagos MP pendientes de validación
    pagosPendientes,
    // 4. Nuevas inscripciones hoy
    alumnosHoy,
    // 5. Pagos registrados hoy (suma)
    pagosHoy,
    // 6. Trials en riesgo (vencen en ≤3 días)
    trialsRisk,
    // 7. Trials vencidos hoy
    trialsExpiredToday,
    // 8. Gyms convertidos este mes
    convertidosMes,
    // 9. Logs ERROR última hora
    errorsH1,
    // 10. Alumnos que vencen hoy en toda la plataforma
    alumnosVencenHoy,
    // 11. Prospectos sin follow-up hace >48h
    prospectosSinSeguimiento,
    // 12. Gyms totales activos
    gymsActivos,
    // 13. MRR aproximado (pagos del mes)
    mrrRows,
    // 14. Gyms sin actividad hace ≥7 días (para contacto manual)
    inactivos,
    // 15. Fraude: alumnos con nombre sospechoso
    alumnosSospechosos,
    // 16. Fraude: WhatsApp registrado en más de una cuenta
    allGymPhones,
    // 17. Fraude: asistencias del mes (para detectar ratio anómalo)
    asistMes,
    // 18. Fraude: alumnos activos por gym (para ratio)
    alumnosActivos,
  ] = await Promise.all([
    sb.from("gym_settings")
      .select("gym_id, wa_status, wa_phone")
      .not("wa_status", "in", '("active","qr")'),

    sb.from("platform_logs")
      .select("id, message, meta, created_at")
      .eq("level", "ERROR")
      .ilike("message", "%send-welcome%")
      .gte("created_at", h24ago)
      .order("created_at", { ascending: false })
      .limit(20),

    sb.from("pagos")
      .select("id, amount, date, alumno_id", { count: "exact" })
      .eq("status", "pendiente")
      .order("date", { ascending: false })
      .limit(10),

    sb.from("alumnos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${todayStr}T00:00:00`)
      .eq("is_demo", false)
      .is("deleted_at", null),

    sb.from("pagos")
      .select("amount")
      .eq("status", "validado")
      .eq("date", todayStr),

    sb.from("platform_accounts")
      .select("id, company_name, owner_name, trial_ends_at, activation_score, status")
      .in("status", ["trial_active", "trial_risk"])
      .lte("trial_ends_at", new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .gte("trial_ends_at", todayStr)
      .order("trial_ends_at"),

    sb.from("platform_accounts")
      .select("id, company_name", { count: "exact", head: true })
      .lte("trial_ends_at", todayStr)
      .in("status", ["trial_active", "trial_risk"]),

    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "converted")
      .gte("converted_at", monthStr),

    sb.from("platform_logs")
      .select("*", { count: "exact", head: true })
      .eq("level", "ERROR")
      .gte("created_at", h1ago),

    sb.from("alumnos")
      .select("id, full_name, gym_id", { count: "exact" })
      .eq("next_expiration_date", todayStr)
      .eq("is_demo", false)
      .is("deleted_at", null)
      .limit(10),

    sb.from("prospectos")
      .select("id, gym_id, phone", { count: "exact", head: true })
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .neq("status", "convertido"),

    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .in("status", ["trial_active", "trial_risk", "converted"]),

    sb.from("pagos")
      .select("amount")
      .eq("status", "validado")
      .gte("date", monthStr)
      .lte("date", todayStr),

    sb.from("platform_accounts")
      .select("id, company_name, owner_name, phone, last_seen_at, status, activation_score")
      .in("status", ["trial_active", "trial_risk", "converted"])
      .not("last_seen_at", "is", null)
      .lt("last_seen_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("last_seen_at", { ascending: true })
      .limit(10),

    sb.from("alumnos")
      .select("id, full_name, gym_id, status")
      .eq("is_demo", false)
      .or("full_name.ilike.%varios%,full_name.ilike.%general%,full_name.ilike.%todos%,full_name.ilike.%clase%,full_name.ilike.%grupo%,full_name.ilike.%temp%,full_name.ilike.%prueba%")
      .is("deleted_at", null)
      .limit(20),

    sb.from("gym_settings")
      .select("gym_id, whatsapp")
      .not("whatsapp", "is", null),

    sb.from("asistencias")
      .select("alumno_id, gym_id")
      .gte("fecha", monthStr),

    sb.from("alumnos")
      .select("id, gym_id, full_name")
      .eq("status", "activo")
      .eq("is_demo", false)
      .is("deleted_at", null),
  ]);

  // ── Detección de fraude ─────────────────────────────────────────────────

  // WhatsApp duplicado entre cuentas
  const phoneCount: Record<string, string[]> = {};
  for (const r of allGymPhones.data ?? []) {
    if (!r.whatsapp) continue;
    const n = r.whatsapp.replace(/\D/g, "");
    if (!phoneCount[n]) phoneCount[n] = [];
    phoneCount[n].push(r.gym_id);
  }
  const waDuplicados = Object.entries(phoneCount)
    .filter(([, ids]) => ids.length > 1)
    .map(([phone, gym_ids]) => ({ phone, gym_ids }));

  // Ratio asistencias/alumnos por gym (flag si >15 asist/alumno activo en el mes)
  const asistPorGym: Record<string, number> = {};
  for (const r of asistMes.data ?? []) {
    asistPorGym[r.gym_id] = (asistPorGym[r.gym_id] ?? 0) + 1;
  }
  const alumnosPorGym: Record<string, { count: number; names: string[] }> = {};
  for (const a of alumnosActivos.data ?? []) {
    if (!alumnosPorGym[a.gym_id]) alumnosPorGym[a.gym_id] = { count: 0, names: [] };
    alumnosPorGym[a.gym_id].count += 1;
    if (alumnosPorGym[a.gym_id].names.length < 3) alumnosPorGym[a.gym_id].names.push(a.full_name);
  }
  const ratioAnomalos = Object.entries(asistPorGym)
    .map(([gym_id, asist]) => {
      const alumnos = alumnosPorGym[gym_id]?.count ?? 0;
      const ratio   = alumnos > 0 ? Math.round(asist / alumnos) : asist;
      return { gym_id, asist_mes: asist, alumnos_activos: alumnos, ratio };
    })
    .filter(r => r.alumnos_activos < 8 && r.asist_mes > 40)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);

  const waDisconnected = (waRows.data ?? []).filter(r => r.wa_status !== null);
  const waNoSession    = (waRows.data ?? []).filter(r => r.wa_status === null || r.wa_status === "disconnected");

  const pagosHoyTotal = (pagosHoy.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const mrrTotal      = (mrrRows.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const pagosPendCount = pagosPendientes.count ?? 0;

  return NextResponse.json({
    // WhatsApp
    wa_disconnected_count: waDisconnected.length,
    wa_no_session_count:   waNoSession.length,
    wa_msg_errors_24h:     waMsgErrors.data?.length ?? 0,
    wa_msg_error_details:  waMsgErrors.data ?? [],

    // Pagos
    pagos_pendientes_count: pagosPendCount,
    pagos_pendientes:       pagosPendientes.data ?? [],
    pagos_hoy_total:        pagosHoyTotal,
    revenue_bruto_mes:      mrrTotal,

    // Alumnos
    alumnos_nuevos_hoy:    alumnosHoy.count ?? 0,
    alumnos_vencen_hoy:    alumnosVencenHoy.count ?? 0,
    alumnos_vencen_sample: alumnosVencenHoy.data ?? [],

    // Trials / cuentas
    trials_en_riesgo:        trialsRisk.data ?? [],
    trials_vencidos_hoy:     trialsExpiredToday.count ?? 0,
    convertidos_este_mes:    convertidosMes.count ?? 0,
    gyms_activos:            gymsActivos.count ?? 0,

    // Prospectos
    prospectos_sin_seguimiento: prospectosSinSeguimiento.count ?? 0,

    // Inactivos para contacto manual
    gyms_inactivos_7d: inactivos.data ?? [],

    // Sistema
    errors_ultima_hora: errorsH1.count ?? 0,

    // Fraude / integridad
    fraude_nombres_sospechosos: alumnosSospechosos.data ?? [],
    fraude_wa_duplicados:       waDuplicados,
    fraude_ratio_anomalos:      ratioAnomalos,

    ts: now.toISOString(),
  });
}
