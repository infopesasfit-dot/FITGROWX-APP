import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getTodayDate } from "@/lib/date-utils";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  const ejercicio = searchParams.get("ejercicio");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  let query = supabase.from("progreso_pesos").select("id, ejercicio, peso, fecha, notas").eq("alumno_id", alumno_id).order("fecha", { ascending: false });
  if (ejercicio) query = query.eq("ejercicio", ejercicio);

  const { data } = await query.limit(50);
  return NextResponse.json({ pesos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, ejercicio, peso, notas } = await req.json();
  if (!alumno_id || !gym_id || !ejercicio || peso == null) return NextResponse.json({ error: "Parámetros faltantes." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("progreso_pesos")
    .insert({
      alumno_id,
      gym_id,
      ejercicio,
      peso: Number(peso),
      notas: notas ?? null,
      fecha: getTodayDate(),
    })
    .select("id, ejercicio, peso, fecha, notas")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, peso: data });
}
