import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";

const sb = getSupabaseAdminClient();

export async function PATCH(req: NextRequest) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, resolved } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: before } = await sb.from("platform_feedback").select("resolved_at, resolved_by, gym_id, message").eq("id", id).maybeSingle();

  const resolvedAt = resolved ? new Date().toISOString() : null;
  const { error } = await sb.from("platform_feedback").update({
    resolved_at: resolvedAt,
    resolved_by: resolved ? user.email : null,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logPlatformAudit(sb, {
    actor_id: user.id,
    action: resolved ? "resolve_feedback" : "unresolve_feedback",
    resource_type: "platform_feedback",
    resource_id: id,
    before_state: before ?? null,
    after_state: { resolved_at: resolvedAt, resolved_by: resolved ? user.email : null },
  });

  return NextResponse.json({ ok: true });
}
