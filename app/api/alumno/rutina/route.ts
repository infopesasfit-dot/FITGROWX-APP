import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });

  const { data } = await supabase.from("rutinas").select("nombre, ejercicios, updated_at").eq("alumno_id", alumno_id).single();
  return NextResponse.json({ rutina: data ?? null });
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, nombre, ejercicios, notas } = await req.json();
  if (!alumno_id || !gym_id) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });

  const { error } = await supabase.from("rutinas").upsert(
    { alumno_id, gym_id, nombre: nombre ?? "Mi Rutina", ejercicios: ejercicios ?? [], notas: notas ?? null, updated_at: new Date().toISOString() },
    { onConflict: "alumno_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
