import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

async function writeResellerAuditLog(entry: {
  actor_id: string | null;
  entity_type: "reseller" | "application";
  entity_id: string;
  action: "approve" | "reject" | "update" | "soft_delete" | "category_change" | "create";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes?: string;
}) {
  try {
    const { error } = await sb.from("reseller_audit_log").insert(entry);
    if (error) console.error("Reseller audit log failed:", error.message);
  } catch (error) {
    console.error("Reseller audit log failed:", error);
  }
}

export async function POST(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { resellerId } = await req.json();
  if (!resellerId) return NextResponse.json({ error: "resellerId requerido" }, { status: 400 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, user_id, status, slug, tier, commission_pct")
    .eq("id", resellerId)
    .maybeSingle();

  if (!reseller) return NextResponse.json({ error: "Reseller no encontrado" }, { status: 404 });

  const { error: updateErr } = await sb
    .from("resellers")
    .update({ status: "deleted", updated_at: new Date().toISOString() })
    .eq("id", resellerId);
if (updateErr) {
  void logger.error("db error", { route: "/platform/resellers/delete", meta: { updateErr } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  await writeResellerAuditLog({
    actor_id: actor.id,
    entity_type: "reseller",
    entity_id: resellerId,
    action: "soft_delete",
    before: reseller,
    after: { ...reseller, status: "deleted" },
  });

  return NextResponse.json({ ok: true });
}
