import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

export async function POST(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { resellerId } = await req.json();
  if (!resellerId) return NextResponse.json({ error: "resellerId requerido" }, { status: 400 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, user_id")
    .eq("id", resellerId)
    .maybeSingle();

  if (!reseller) return NextResponse.json({ error: "Reseller no encontrado" }, { status: 404 });

  const { error: updateErr } = await sb
    .from("resellers")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", resellerId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
