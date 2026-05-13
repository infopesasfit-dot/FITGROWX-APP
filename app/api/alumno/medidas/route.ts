import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const alumno_id = searchParams.get("alumno_id");
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });

  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const { data } = await supabase
    .from("medidas_corporales")
    .select("id, peso_kg, grasa_pct, cintura_cm, fecha")
    .eq("alumno_id", alumno_id)
    .order("fecha", { ascending: false })
    .limit(30);

  return NextResponse.json({ medidas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { alumno_id, gym_id, peso_kg, grasa_pct, cintura_cm, notas } = await req.json();
  if (!alumno_id || !gym_id || peso_kg == null) {
    return NextResponse.json({ error: "alumno_id, gym_id y peso_kg son requeridos." }, { status: 400 });
  }
  if (peso_kg < 20 || peso_kg > 300) {
    return NextResponse.json({ error: "Peso fuera de rango válido." }, { status: 400 });
  }

  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.alumno_id !== alumno_id || tokenRow.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("medidas_corporales")
    .insert({
      alumno_id,
      gym_id,
      peso_kg: Number(peso_kg),
      grasa_pct: grasa_pct != null ? Number(grasa_pct) : null,
      cintura_cm: cintura_cm != null ? Number(cintura_cm) : null,
      notas: notas ?? null,
    })
    .select("id, peso_kg, grasa_pct, cintura_cm, fecha")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, medida: data });
}
