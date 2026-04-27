import { NextRequest, NextResponse } from "next/server";
import { getCurrentTime, getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const { alumno_id, fecha } = await req.json();
  if (!alumno_id) return NextResponse.json({ ok: false, error: "alumno_id requerido." }, { status: 400 });

  const dateStr = fecha ?? getTodayDate();
  const hora = getCurrentTime();

  const { data: alumno } = await supabaseAdmin
    .from("alumnos")
    .select("id, gym_id, status, next_expiration_date")
    .eq("id", alumno_id)
    .eq("gym_id", profile.gym_id)
    .single();

  if (!alumno) return NextResponse.json({ ok: false, error: "Alumno no encontrado." }, { status: 404 });

  const isExpired = Boolean(alumno.next_expiration_date && alumno.next_expiration_date < dateStr);
  const isActive = alumno.status === "activo";
  if (!isActive || isExpired) {
    return NextResponse.json({
      ok: false,
      error: isExpired
        ? "No se puede registrar asistencia: la membresía está vencida."
        : "No se puede registrar asistencia: la membresía está inactiva.",
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from("asistencias")
    .upsert({ gym_id: alumno.gym_id, alumno_id, fecha: dateStr, hora }, { onConflict: "alumno_id,fecha" });

  if (error) {
    console.error("[checkin-manual]", error.message);
    return NextResponse.json({
      ok: false,
      error: "No se pudo registrar la asistencia por un error del sistema.",
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, fecha: dateStr, hora });
}
