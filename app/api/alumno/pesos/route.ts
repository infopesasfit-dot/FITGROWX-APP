import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  const ejercicio = searchParams.get("ejercicio");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });

  let query = supabase.from("progreso_pesos").select("id, ejercicio, peso, fecha, notas").eq("alumno_id", alumno_id).order("fecha", { ascending: false });
  if (ejercicio) query = query.eq("ejercicio", ejercicio);

  const { data } = await query.limit(50);
  return NextResponse.json({ pesos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, ejercicio, peso, notas } = await req.json();
  if (!alumno_id || !gym_id || !ejercicio || peso == null) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });

  const { error } = await supabase.from("progreso_pesos").insert({ alumno_id, gym_id, ejercicio, peso: Number(peso), notas: notas ?? null, fecha: new Date().toISOString().slice(0, 10) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
