import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const sb = getSupabaseAdminClient();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? sb : null;
}

export async function GET(req: NextRequest) {
  const sb = await assertPlatformOwner();
  if (!sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all"; // all | errors | pending

  let query = sb
    .from("mp_webhook_log")
    .select("id, source, gym_id, payment_id, event_type, status, error_msg, amount, alumno_id, received_at")
    .order("received_at", { ascending: false })
    .limit(100);

  if (filter === "errors")  query = query.eq("status", "error");
  if (filter === "pending") query = query.eq("status", "received");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logs: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const sb = await assertPlatformOwner();
  if (!sb) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json() as { id: string; status: string };
  if (!id || !status) return NextResponse.json({ error: "id y status requeridos" }, { status: 400 });

  const { error } = await sb.from("mp_webhook_log").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
