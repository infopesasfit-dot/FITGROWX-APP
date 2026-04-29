import { NextRequest, NextResponse } from "next/server";
import { getPlanNombre } from "@/lib/supabase-relations";
import { getCurrentTime, getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type TokenRow  = { alumno_id: string; gym_id: string; expires_at: string };
type AlumnoRow = { id: string; gym_id: string; full_name: string; status: string | null; planes: unknown; next_expiration_date: string | null };
type ExistingRow = { id: string; hora: string | null };

export async function POST(req: NextRequest) {
  const { gym_id } = await req.json();
  if (!gym_id) return NextResponse.json({ ok: false, error: "gym_id requerido." }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  // ── Modo automático: token en Authorization header ──────────────────────────
  let alumnoId: string | null = null;
  const rawToken = req.headers.get("authorization")?.replace("Bearer ", "").trim() ?? null;

  if (rawToken) {
    const { data: tokenRow } = await supabase
      .from("alumno_tokens")
      .select("alumno_id, gym_id, expires_at")
      .eq("token", rawToken)
      .maybeSingle<TokenRow>();

    if (tokenRow && tokenRow.gym_id === gym_id && new Date(tokenRow.expires_at) > new Date()) {
      alumnoId = tokenRow.alumno_id;
    }
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
    .select("id, gym_id, full_name, status, planes(nombre), next_expiration_date")
    .eq("gym_id", gym_id)
    .eq("id", alumnoId)
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
  const { error: insErr } = await supabase.from("asistencias").insert({
    gym_id: alumnoRow.gym_id,
    alumno_id: alumnoRow.id,
    fecha: today,
    hora,
  } as never);

  if (insErr) {
    return NextResponse.json({ ok: false, error: "Error al registrar la asistencia. Intentá de nuevo." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    already: false,
    alumno: { full_name: alumnoRow.full_name, plan: getPlanNombre(alumnoRow.planes), status: alumnoRow.status },
    hora,
  });
}
