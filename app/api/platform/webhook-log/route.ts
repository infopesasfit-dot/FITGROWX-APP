import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const sb = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
if (error) {
  void logger.error("db error", { route: "/platform/webhook-log", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, logs: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, status } = await req.json() as { id: string; status: string };
  if (!id || !status) return NextResponse.json({ error: "id y status requeridos" }, { status: 400 });

  const { data: before } = await sb.from("mp_webhook_log").select("status, gym_id, payment_id, event_type").eq("id", id).maybeSingle();

  const { error } = await sb.from("mp_webhook_log").update({ status }).eq("id", id);
if (error) {
  void logger.error("db error", { route: "/platform/webhook-log", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "mark_webhook_resolved",
    resource_type: "mp_webhook_log",
    resource_id: id,
    before_state: before ?? null,
    after_state: { status, gym_id: before?.gym_id ?? null, payment_id: before?.payment_id ?? null },
  });

  return NextResponse.json({ ok: true });
}
