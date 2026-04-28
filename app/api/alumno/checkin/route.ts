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

type ExistingAsistenciaRow = {
  id: string;
  hora: string | null;
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

  // QR format: "FITGROWX:{DNI}"
  if (!qr_data || !qr_data.startsWith("FITGROWX:")) {
    return NextResponse.json({
      ok: false,
      error: "QR inválido.",
      error_code: "invalid_qr",
      error_title: "QR inválido",
      error_hint: "Pedile al alumno que vuelva a mostrar su código o ingresá el DNI manualmente.",
    }, { status: 400 });
  }

  const dni = qr_data.slice("FITGROWX:".length).trim();
  if (!dni) {
    return NextResponse.json({
      ok: false,
      error: "QR inválido.",
      error_code: "invalid_qr",
      error_title: "QR inválido",
      error_hint: "Pedile al alumno que vuelva a mostrar su código o ingresá el DNI manualmente.",
    }, { status: 400 });
  }

  const { data: alumno, error } = await supabaseAdmin
    .from("alumnos")
    .select("id, gym_id, full_name, status, phone, planes(nombre, accent_color), next_expiration_date")
    .eq("dni", dni)
    .eq("gym_id", profileRow.gym_id)
    .single();
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

  // Check if already checked in today
  const { data: existing } = await supabaseAdmin
    .from("asistencias")
    .select("id, hora")
    .eq("alumno_id", alumno_id)
    .eq("fecha", today)
    .maybeSingle();
  const existingRow = existing as ExistingAsistenciaRow | null;

  if (existingRow) {
    return NextResponse.json({
      ok: true,
      already: true,
      alumno: {
        full_name: alumnoRow.full_name,
        plan: getPlanNombre(alumnoRow.planes),
        status: alumnoRow.status,
        expiration: alumnoRow.next_expiration_date,
      },
      hora: existingRow.hora,
    });
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
