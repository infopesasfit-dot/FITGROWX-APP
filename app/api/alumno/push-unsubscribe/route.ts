import { NextRequest, NextResponse } from "next/server";
import { requireAlumnoActionAllowed } from "@/lib/alumno-action-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  try {
    const access = await requireAlumnoActionAllowed(req);
    if ("response" in access) return access.response;
    const { tokenRow } = access;

    await supabase.from("push_subscriptions").delete().eq("alumno_id", tokenRow.alumno_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push-unsubscribe]", err);
    return NextResponse.json({ error: "Error del servidor." }, { status: 500 });
  }
}
