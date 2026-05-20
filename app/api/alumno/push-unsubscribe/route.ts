import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  try {
    const tokenRow = await getValidAlumnoToken(req);
    if (!tokenRow) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const { alumno_id } = raw as Record<string, unknown>;

    if (typeof alumno_id !== "string") {
      return NextResponse.json({ error: "alumno_id requerido." }, { status: 400 });
    }

    // Verify ownership: alumno_id from request must match token's alumno_id
    if (alumno_id !== tokenRow.alumno_id) {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    await supabase.from("push_subscriptions").delete().eq("alumno_id", tokenRow.alumno_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push-unsubscribe]", err);
    return NextResponse.json({ error: "Error del servidor." }, { status: 500 });
  }
}
