import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const { alumno_id } = await req.json();
  if (!alumno_id) return NextResponse.json({ error: "alumno_id requerido" }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("alumno_tokens")
    .update({ expires_at: new Date().toISOString() })
    .eq("alumno_id", alumno_id)
    .gt("expires_at", new Date().toISOString());

  if (error) {
    console.error("[invalidate-tokens]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
