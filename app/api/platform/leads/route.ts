import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

const VALID_STATUSES = ["new", "contacted", "demo_scheduled", "registered", "converted", "churned", "disqualified"] as const;

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

// PATCH /api/platform/leads — update platform_lead status
export async function PATCH(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { id, status } = body ?? {};

  if (!id || typeof id !== "string") return NextResponse.json({ error: "id requerido." }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "status inválido." }, { status: 400 });

  const { data: before } = await sb.from("platform_leads").select("status, full_name, email").eq("id", id).maybeSingle();

  const { error } = await sb.from("platform_leads").update({ status }).eq("id", id);
if (error) {
  void logger.error("db error", { route: "/platform/leads", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "update_lead_status",
    resource_type: "platform_lead",
    resource_id: id,
    before_state: before ?? null,
    after_state: { status },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/platform/leads?id=<uuid>
export async function DELETE(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  const { data: before } = await sb.from("platform_leads").select("status, full_name, email, phone").eq("id", id).maybeSingle();

  const { error } = await sb.from("platform_leads").delete().eq("id", id);
if (error) {
  void logger.error("db error", { route: "/platform/leads", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "delete_lead",
    resource_type: "platform_lead",
    resource_id: id,
    before_state: before ?? null,
    after_state: null,
  });

  return NextResponse.json({ ok: true });
}
