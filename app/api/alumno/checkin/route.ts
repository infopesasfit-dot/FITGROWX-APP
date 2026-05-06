import { NextRequest, NextResponse } from "next/server";
import { getPlanNombre } from "@/lib/supabase-relations";
import { getCurrentTime, getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type StaffProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | string | null;
};

type AlumnoRow = {
  id: string;
  gym_id: string;
  full_name: string;
  status: string | null;
  phone: string | null;
  planes: unknown;
  next_expiration_date: string | null;
};

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({
      ok: false,
      error: "No autorizado.",
      error_code: "unauthorized",
      error_title: "Sin autorización",
      error_hint: "Iniciá sesión nuevamente antes de escanear.",
    }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .maybeSingle<StaffProfile>();

  const profileRow = profile as StaffProfile | null;
  const profileRole = profileRow?.role ?? null;
  if (profileError || !profileRow || !profileRole || !["admin", "staff"].includes(profileRole)) {
    return NextResponse.json({
      ok: false,
      error: "No autorizado.",
      error_code: "forbidden",
      error_title: "Sin permisos",
      error_hint: "Tu usuario no tiene permisos para registrar asistencias.",
    }, { status: 403 });
  }
  if (!profileRow.gym_id) {
    return NextResponse.json({
      ok: false,
      error: "No autorizado.",
      error_code: "forbidden",
      error_title: "Sin permisos",
      error_hint: "No se encontró un gimnasio asociado a este usuario.",
    }, { status: 403 });
  }

  const { qr_data } = await req.json();

  if (!qr_data || !qr_data.startsWith("FITGROWX:")) {
    return NextResponse.json({
      ok: false,
      error: "QR inválido.",
      error_code: "invalid_qr",
      error_title: "QR inválido",
      error_hint: "Pedile al alumno que vuelva a mostrar su código o ingresá el DNI manualmente.",
    }, { status: 400 });
  }

  const payload = qr_data.slice("FITGROWX:".length).trim();
  if (!payload) {
    return NextResponse.json({
      ok: false,
      error: "QR inválido.",
      error_code: "invalid_qr",
      error_title: "QR inválido",
      error_hint: "Pedile al alumno que vuelva a mostrar su código o ingresá el DNI manualmente.",
    }, { status: 400 });
  }

  // Formato nuevo: FITGROWX:ID:{alumno_id}  →  buscar por id
  // Formato viejo: FITGROWX:{dni}            →  buscar por dni (retrocompatible)
  const byId = payload.startsWith("ID:");
  const lookup = byId ? payload.slice(3) : payload;

  const baseQuery = supabaseAdmin
    .from("alumnos")
    .select("id, gym_id, full_name, status, phone, planes(nombre, accent_color), next_expiration_date")
    .eq("gym_id", profileRow.gym_id);

  const { data: alumno, error } = await (byId
    ? baseQuery.eq("id", lookup)
    : baseQuery.eq("dni", lookup)
  ).single();
  const alumnoRow = alumno as AlumnoRow | null;

  if (error || !alumnoRow) {
    return NextResponse.json({
      ok: false,
      error: "Alumno no encontrado.",
      error_code: "student_not_found",
      error_title: "Alumno no encontrado",
      error_hint: "Verificá que el QR pertenezca a este gimnasio o registrá la asistencia manualmente.",
    }, { status: 404 });
  }

  const today = getTodayDate();
  const alumno_id = alumnoRow.id;
  const expiration = alumnoRow.next_expiration_date;
  const isExpired = Boolean(expiration && expiration < today);
  const isActive = alumnoRow.status === "activo";

  if (!isActive || isExpired) {
    const membershipErrorCode = isExpired ? "membership_expired" : "membership_inactive";
    const membershipErrorTitle = isExpired ? "Membresía vencida" : "Membresía inactiva";
    const membershipError = isExpired
      ? "La membresía del alumno está vencida."
      : "La membresía del alumno no está activa.";

    return NextResponse.json({
      ok: false,
      error: membershipError,
      error_code: membershipErrorCode,
      error_title: membershipErrorTitle,
      error_hint: "No registrar asistencia hasta regularizar el pago o actualizar el estado del alumno.",
      alumno: {
        full_name: alumnoRow.full_name,
        plan: getPlanNombre(alumnoRow.planes),
        status: alumnoRow.status,
        expiration,
      },
    }, { status: 409 });
  }

  const hora = getCurrentTime();

  const { error: insErr } = await supabaseAdmin.from("asistencias").insert({
    gym_id: alumnoRow.gym_id,
    alumno_id,
    fecha: today,
    hora,
  } as never);

  if (insErr) {
    console.error("[checkin] insert error:", insErr.message, insErr.code, insErr.details);
    return NextResponse.json({
      ok: false,
      error: "No se pudo registrar la asistencia por un error del sistema.",
      error_code: "system_error",
      error_title: "Error del sistema",
      error_hint: "Probá de nuevo o hacé el check-in manual desde Alumnos.",
    }, { status: 500 });
  }

  // Fire presente WA message — non-blocking
  const motor = process.env.WA_MOTOR_URL;
  if (motor && alumnoRow.phone) {
    void (async () => {
      const { data: gs } = await supabaseAdmin
        .from("gym_settings")
        .select("vencimiento_activo, diadia_presente_msg, gym_name")
        .eq("gym_id", alumnoRow.gym_id)
        .maybeSingle();
      if (!gs?.vencimiento_activo) return;
      if (gs.diadia_presente_msg === "") return; // desactivado
      const DEFAULT = `¡Entraste, {nombre}! 🙌 Tu presente queda marcado. ¡A romperla hoy!`;
      const msg = (gs.diadia_presente_msg?.trim() || DEFAULT)
        .replace(/{nombre}/g, alumnoRow.full_name)
        .replace(/{gym}/g, gs.gym_name ?? "el gym");
      const digits = alumnoRow.phone!.replace(/\D/g, "");
      const phone = digits.startsWith("549") && digits.length === 13 ? digits
        : digits.startsWith("54") && digits.length === 12 ? "549" + digits.slice(2)
        : digits.length === 10 ? "549" + digits : digits;
      try {
        await fetch(`${motor}/send/${alumnoRow.gym_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
          body: JSON.stringify({ phone, message: msg }),
          signal: AbortSignal.timeout(8000),
        });
      } catch { /* non-fatal */ }
    })();
  }

  return NextResponse.json({
    ok: true,
    already: false,
    alumno: {
      full_name: alumnoRow.full_name,
      plan: getPlanNombre(alumnoRow.planes),
      status: alumnoRow.status,
      expiration: alumnoRow.next_expiration_date,
    },
    hora,
  });
}
