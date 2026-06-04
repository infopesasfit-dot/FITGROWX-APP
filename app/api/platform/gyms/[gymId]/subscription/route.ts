import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gymId } = await params;
  if (!gymId) return NextResponse.json({ error: "gymId requerido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { active } = body ?? {};
  if (typeof active !== "boolean") return NextResponse.json({ error: "active (boolean) requerido." }, { status: 400 });

  const { data: currentGym } = await sb.from("gyms").select("is_subscription_active,gym_status").eq("id", gymId).maybeSingle();

  const { error } = await sb
    .from("gyms")
    .update({
      is_subscription_active: active,
      gym_status: active ? "active" : "cancelled",
    })
    .eq("id", gymId);

if (error) {
  void logger.error("db error", { route: "/platform/gyms/[gymId]/subscription", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: user.id,
    action: "subscription_toggle",
    resource_type: "gym",
    resource_id: gymId,
    before_state: currentGym ? { is_subscription_active: currentGym.is_subscription_active, gym_status: currentGym.gym_status } : null,
    after_state: { is_subscription_active: active, gym_status: active ? "active" : "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
