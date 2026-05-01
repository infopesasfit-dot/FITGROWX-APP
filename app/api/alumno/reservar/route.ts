import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

function getWeekRange(dateStr: string) {
  const date = new Date(`${dateStr}T12:00:00`);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, clase_id, fecha } = await req.json();
  if (!alumno_id || !gym_id || !clase_id || !fecha) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { data: clase } = await supabase.from("gym_classes").select("max_capacity, class_name, gym_id").eq("id", clase_id).single();
  if (!clase) return NextResponse.json({ error: "Clase no encontrada." }, { status: 404 });
  if (clase.gym_id !== gym_id) return NextResponse.json({ error: "Clase inválida para este gimnasio." }, { status: 403 });

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("plan_id, planes!plan_id(access_type, classes_per_week)")
    .eq("id", alumno_id)
    .eq("gym_id", gym_id)
    .maybeSingle();

  const plan = Array.isArray(alumno?.planes) ? alumno?.planes[0] : alumno?.planes;
  const accessType = typeof plan?.access_type === "string" ? plan.access_type : "libre";
  const classesPerWeek = typeof plan?.classes_per_week === "number" ? plan.classes_per_week : null;

  if (accessType === "clases_por_semana" && classesPerWeek && classesPerWeek > 0) {
    const { from, to } = getWeekRange(fecha);
    const { count: weeklyCount } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gym_id)
      .eq("alumno_id", alumno_id)
      .eq("estado", "confirmada")
      .gte("fecha", from)
      .lte("fecha", to);

    if ((weeklyCount ?? 0) >= classesPerWeek) {
      return NextResponse.json({ error: `Tu plan permite ${classesPerWeek} clase${classesPerWeek === 1 ? "" : "s"} por semana.` }, { status: 409 });
    }
  }

  const { count } = await supabase.from("reservas").select("id", { count: "exact", head: true }).eq("clase_id", clase_id).eq("fecha", fecha).eq("estado", "confirmada");
  if ((count ?? 0) >= clase.max_capacity) return NextResponse.json({ error: "La clase ya está completa para esa fecha." }, { status: 409 });

  const { error } = await supabase.from("reservas").insert({ gym_id, alumno_id, clase_id, fecha, estado: "confirmada" });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Ya tenés una reserva para esa clase y fecha." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { alumno_id, clase_id, fecha } = await req.json();
  if (!alumno_id || !clase_id || !fecha) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "cancelada" })
    .eq("alumno_id", alumno_id)
    .eq("gym_id", tokenRow.gym_id)
    .eq("clase_id", clase_id)
    .eq("fecha", fecha);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
