import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function PATCH(req: NextRequest) {
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Formato inválido." }, { status: 400 }); }

  const allowed = ["full_name", "phone", "email"] as const;
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const val = String(body[key]).trim();
      if (val.length > 200) return NextResponse.json({ error: `${key} demasiado largo.` }, { status: 400 });
      update[key] = val || null;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar." }, { status: 400 });
  }

  const { error } = await supabase
    .from("alumnos")
    .update(update)
    .eq("id", tokenRow.alumno_id)
    .eq("gym_id", tokenRow.gym_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
