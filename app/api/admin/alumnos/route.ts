import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
};

const admin = getSupabaseAdminClient();

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || !["admin", "staff", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const [{ data: alumnosData, error: alumnosError }, { data: planesData, error: planesError }, { data: promosData }, { data: asistenciasData, error: asistenciasError }] =
    await Promise.all([
      admin
        .from("alumnos")
        .select("id, dni, full_name, phone, plan_id, status, next_expiration_date, planes!plan_id(nombre, accent_color, precio, duracion_dias)")
        .eq("gym_id", gymId)
        .order("full_name"),
      admin
        .from("planes")
        .select("id, nombre, precio, periodo, duracion_dias, accent_color")
        .eq("gym_id", gymId)
        .eq("active", true)
        .order("created_at"),
      admin
        .from("gym_promotions")
        .select("id, nombre, discount_type, discount_value, note")
        .eq("gym_id", gymId)
        .eq("active", true)
        .order("created_at"),
      admin
        .from("asistencias")
        .select("alumno_id, fecha")
        .eq("gym_id", gymId)
        .gte("fecha", sixtyDaysAgo.toISOString().slice(0, 10))
        .order("fecha", { ascending: false }),
    ]);

  if (alumnosError || planesError || asistenciasError) {
    return NextResponse.json(
      { ok: false, error: alumnosError?.message ?? planesError?.message ?? asistenciasError?.message ?? "No se pudo cargar alumnos." },
      { status: 500 },
    );
  }

  const ultimaMap: Record<string, string> = {};
  for (const row of (asistenciasData ?? []) as { alumno_id: string; fecha: string }[]) {
    if (!ultimaMap[row.alumno_id]) ultimaMap[row.alumno_id] = row.fecha;
  }

  return NextResponse.json({
    ok: true,
    gym_id: gymId,
    role: profile.role ?? "admin",
    alumnos: alumnosData ?? [],
    planes: planesData ?? [],
    promos: promosData ?? [],
    ultimaMap,
  });
}
