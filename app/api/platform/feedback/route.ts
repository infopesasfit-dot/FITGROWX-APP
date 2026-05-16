import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

export async function PATCH(req: NextRequest) {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "platform_owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, resolved } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await sb.from("platform_feedback").update({
    resolved_at: resolved ? new Date().toISOString() : null,
    resolved_by: resolved ? user.email : null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
