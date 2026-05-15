import { sanitizeError } from "@/lib/api-error";
import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data, error } = await supabase
    .from("alumno_notifications")
    .select("id, type, title, body, link, leida, created_at")
    .eq("alumno_id", tokenRow.alumno_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id, all } = await req.json();

  if (all) {
    await supabase
      .from("alumno_notifications")
      .update({ leida: true })
      .eq("alumno_id", tokenRow.alumno_id)
      .eq("leida", false);
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  const { data: existing } = await supabase
    .from("alumno_notifications")
    .select("id")
    .eq("id", id)
    .eq("alumno_id", tokenRow.alumno_id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "No encontrada." }, { status: 404 });

  await supabase.from("alumno_notifications").update({ leida: true }).eq("id", id);
  return NextResponse.json({ ok: true });
}
