import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidAlumnoToken } from "@/lib/alumno-token";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
