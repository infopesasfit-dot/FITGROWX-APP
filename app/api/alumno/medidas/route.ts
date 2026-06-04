import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireAlumnoActionAllowed } from "@/lib/alumno-action-guard";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data } = await supabase
    .from("medidas_corporales")
    .select("id, peso_kg, grasa_pct, musculo_pct, cintura_cm, cadera_cm, brazo_cm, pierna_cm, fecha")
    .eq("alumno_id", tokenRow.alumno_id)
    .order("fecha", { ascending: false })
    .limit(30);

  return NextResponse.json({ medidas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const access = await requireAlumnoActionAllowed(req);
  if ("response" in access) return access.response;
  const { tokenRow } = access;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const { peso_kg, grasa_pct, musculo_pct, cintura_cm, cadera_cm, brazo_cm, pierna_cm, notas } = body;

  if (peso_kg == null) return NextResponse.json({ error: "peso_kg es requerido." }, { status: 400 });
  const pesoNum = Number(peso_kg);
  if (isNaN(pesoNum) || pesoNum < 20 || pesoNum > 300) {
    return NextResponse.json({ error: "Peso fuera de rango válido (20–300 kg)." }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    alumno_id: tokenRow.alumno_id,
    gym_id:    tokenRow.gym_id,
    peso_kg:   pesoNum,
    notas:     notas ?? null,
  };
  if (grasa_pct   != null) row.grasa_pct   = Number(grasa_pct);
  if (musculo_pct != null) row.musculo_pct = Number(musculo_pct);
  if (cintura_cm  != null) row.cintura_cm  = Number(cintura_cm);
  if (cadera_cm   != null) row.cadera_cm   = Number(cadera_cm);
  if (brazo_cm    != null) row.brazo_cm    = Number(brazo_cm);
  if (pierna_cm   != null) row.pierna_cm   = Number(pierna_cm);

  const { data, error } = await supabase
    .from("medidas_corporales")
    .insert(row)
    .select("id, peso_kg, grasa_pct, musculo_pct, cintura_cm, cadera_cm, brazo_cm, pierna_cm, fecha")
    .single();

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ ok: true, medida: data });
}
