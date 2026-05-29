import { NextRequest, NextResponse } from "next/server";
import { getPlanNombre } from "@/lib/supabase-relations";
import { getCurrentTime, getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp } from "@/lib/request-security";
import { getValidAlumnoToken } from "@/lib/alumno-token";

type AlumnoRow = { id: string; gym_id: string; full_name: string; status: string | null; planes: unknown; next_expiration_date: string | null; phone: string | null };
type ExistingRow = { id: string; hora: string | null };

export async function POST(req: NextRequest) {
  const limit = await applyRateLimit({ namespace: "checkin:ip", identifier: getClientIp(req), windowMs: 60_000, maxAttempts: 20 });
  if (!limit.allowed) return NextResponse.json({ ok: false, error: "Demasiados intentos." }, { status: 429 });

  const { gym_id } = await req.json();
  if (!gym_id) return NextResponse.json({ ok: false, error: "gym_id requerido." }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  // ── Validación de token: Bearer header o cookie httpOnly ─────────────────────
  const tokenRow = await getValidAlumnoToken(req);
  let alumnoId: string | null = null;

  if (tokenRow && tokenRow.gym_id === gym_id) {
    alumnoId = tokenRow.alumno_id;
  }

  if (!alumnoId) {
    return NextResponse.json({
      ok: false,
      error_code: "auth_required",
      error: "Necesitás iniciar sesión en tu panel para registrar la asistencia desde tu celular. Si no, pedile al staff que la cargue manualmente.",
    }, { status: 401 });
  }

  // ── Buscar alumno ───────────────────────────────────────────────────────────
  const { data: alumno, error } = await supabase
    .from("alumnos")
    .select("id, gym_id, full_name, status, planes(nombre), next_expiration_date, phone")
    .eq("gym_id", gym_id)
    .eq("id", alumnoId)
    .is("deleted_at", null)
    .maybeSingle();
  const alumnoRow = alumno as AlumnoRow | null;

  if (error || !alumnoRow) {
    return NextResponse.json({
      ok: false,
      error_code: "auth_required",
      error: "Tu sesión no es válida para este gimnasio. Volvé a ingresar desde tu panel o pedile ayuda al staff.",
    }, { status: 401 });
  }

  // ── Validar membresía ───────────────────────────────────────────────────────
  const today = getTodayDate();
  const isExpired = Boolean(alumnoRow.next_expiration_date && alumnoRow.next_expiration_date < today);
  const isActive  = alumnoRow.status === "activo";

  if (!isActive || isExpired) {
    // Si está vencido, crear notificación (anti-spam: máx 1 cada 6 horas)
    if (isExpired) {
      try {
        const recentNotif = await supabase
          .from("notifications")
          .select("id")
          .eq("gym_id", alumnoRow.gym_id)
          .eq("type", "checkin_vencido")
          .gte("created_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
          .ilike("link", `%${alumnoRow.id}%`)
          .maybeSingle();

        if (!recentNotif.data) {
          await supabase.from("notifications").insert({
            gym_id: alumnoRow.gym_id,
            type: "checkin_vencido",
            title: `🚫 ${alumnoRow.full_name} intentó entrar con cuota vencida`,
            body: `Venció el ${alumnoRow.next_expiration_date}.${alumnoRow.phone ? ` Tel: ${alumnoRow.phone}` : ""}`,
            link: `/dashboard/alumnos?q=${alumnoRow.id}`,
            read: false,
          });
        }
      } catch (e) {
        console.error("[checkin-publico] notif creation failed:", e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({
      ok: false,
      error: isExpired ? "Tu membresía está vencida." : "Tu membresía no está activa.",
      error_code: isExpired ? "membership_expired" : "membership_inactive",
      alumno: { full_name: alumnoRow.full_name, status: alumnoRow.status, expiration: alumnoRow.next_expiration_date },
    }, { status: 409 });
  }

  // ── Verificar si ya registró hoy ────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("asistencias")
    .select("id, hora")
    .eq("alumno_id", alumnoRow.id)
    .eq("fecha", today)
    .maybeSingle();
  const existingRow = existing as ExistingRow | null;

  if (existingRow) {
    return NextResponse.json({
      ok: true,
      already: true,
      alumno: { full_name: alumnoRow.full_name, plan: getPlanNombre(alumnoRow.planes), status: alumnoRow.status },
      hora: existingRow.hora,
    });
  }

  // ── Registrar asistencia ────────────────────────────────────────────────────
  const hora = getCurrentTime();

  console.log("[checkin-publico] TIMEZONE DEBUG", {
    serverTime_UTC: new Date().toISOString(),
    serverTime_Argentina: new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
    getTodayDate_result: today,
    getCurrentTime_result: hora,
    DATE_NOW: Date.now(),
    TZ_env: process.env.TZ ?? "not set",
  });

  console.log("[checkin-publico] INSERT attempt", { gym_id, alumno_id: alumnoId, fecha: today, hora });

  const { data: insertedData, error: insErr } = await supabase
    .from("asistencias")
    .insert({
      gym_id: gym_id,
      alumno_id: alumnoId,
      fecha: today,
      hora,
    } as never)
    .select("id, gym_id, alumno_id, fecha, hora");

  console.log("[checkin-publico] INSERT result", {
    error: insErr?.message ?? null,
    errorCode: insErr?.code ?? null,
    errorDetails: insErr?.details ?? null,
    rowsReturned: insertedData?.length ?? 0,
    data: insertedData
  });

  if (insErr) {
    console.error("[checkin-publico] insert error:", insErr.message, insErr.code, insErr.details);
    return NextResponse.json({ ok: false, error: "Error al registrar la asistencia. Intentá de nuevo." }, { status: 500 });
  }

  if (!insertedData || insertedData.length === 0) {
    console.error("[checkin-publico] INSERT returned no data — RLS blocked silently?");
    return NextResponse.json({ ok: false, error: "Error al registrar la asistencia. Intentá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    already: false,
    alumno: { full_name: alumnoRow.full_name, plan: getPlanNombre(alumnoRow.planes), status: alumnoRow.status },
    hora,
  });
}
