import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createAlumnoSchema, parseBody } from "@/lib/schemas";
import { canAddAlumno } from "@/lib/gym-plan-status";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | "platform_owner" | string | null;
};

const admin = getSupabaseAdminClient();

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
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

  const [{ data: alumnosData, error: alumnosError }, { data: planesData, error: planesError }, { data: promosData }, { data: asistenciasData, error: asistenciasError }, { data: gymData }] =
    await Promise.all([
      admin
        .from("alumnos")
        .select("id, dni, full_name, phone, plan_id, status, next_expiration_date, frozen_since, pausa_hasta, deuda_pendiente, planes!plan_id(nombre, accent_color, precio, duracion_dias)")
        .eq("gym_id", gymId)
        .is("deleted_at", null)
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
      admin
        .from("gyms")
        .select("plan_type")
        .eq("id", gymId)
        .maybeSingle(),
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

  const isStaff = profile.role === "staff";
  const alumnos = (alumnosData ?? []).map((a: Record<string, unknown>) => {
    if (!isStaff) return a;
    const { dni: _dni, ...rest } = a;
    return rest;
  });

  return NextResponse.json({
    ok: true,
    gym_id: gymId,
    role: profile.role ?? "admin",
    plan_type: (gymData as { plan_type?: string } | null)?.plan_type ?? "crecimiento",
    alumnos,
    planes: planesData ?? [],
    promos: promosData ?? [],
    ultimaMap,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // Verificar plan: trial activo/gracia, plan starter dentro del límite, plan pro ilimitado
  const planCheck = await canAddAlumno(gymId);
  if (!planCheck.allowed) {
    return NextResponse.json({ ok: false, error: planCheck.reason }, { status: 422 });
  }

  const raw = await req.json();
  const parsed = parseBody(createAlumnoSchema, raw);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });

  const { full_name, dni, phone, email, plan_id, status, next_expiration_date, last_payment_date } = parsed.data;

  // ── Duplicate check ──────────────────────────────────────────────
  if (phone || dni) {
    let dupQuery = admin
      .from("alumnos")
      .select("id, full_name, phone, dni, status, next_expiration_date, planes!plan_id(nombre, accent_color, precio, duracion_dias)")
      .eq("gym_id", gymId)
      .is("deleted_at", null);

    if (phone && dni) {
      dupQuery = dupQuery.or(`phone.eq.${phone},dni.eq.${dni}`);
    } else if (phone) {
      dupQuery = dupQuery.eq("phone", phone);
    } else if (dni) {
      dupQuery = dupQuery.eq("dni", dni);
    }

    const { data: existing } = await dupQuery.limit(1).maybeSingle();
    if (existing) {
      const matchedBy = phone && (existing as Record<string, unknown>).phone === phone ? "phone" : "dni";
      return NextResponse.json(
        { ok: false, duplicate: true, existingAlumno: existing, matchedBy },
        { status: 409 },
      );
    }
  }

  const { data: newAlumno, error } = await admin
    .from("alumnos")
    .insert([{
      gym_id: gymId,
      full_name,
      dni:                  dni  ?? null,
      phone:                phone ?? null,
      email:                email ?? null,
      plan_id:              plan_id ?? null,
      status:               status ?? "activo",
      next_expiration_date: next_expiration_date ?? null,
      last_payment_date:    last_payment_date ?? null,
    }])
    .select("id, full_name, dni, phone, email, plan_id, status, next_expiration_date")
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? "Ya existe un alumno con ese DNI, teléfono o email."
      : "No se pudo crear el alumno. Intentá de nuevo.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true, alumno: newAlumno });
}
