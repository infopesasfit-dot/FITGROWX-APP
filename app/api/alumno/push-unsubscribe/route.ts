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

    await supabase.from("push_subscriptions").delete().eq("alumno_id", tokenRow.alumno_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push-unsubscribe]", err);
    return NextResponse.json({ error: "Error del servidor." }, { status: 500 });
  }
}
