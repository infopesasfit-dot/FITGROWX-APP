import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

const VALID_PLANS = ["trial", "starter", "crecimiento"] as const;
type PlanType = typeof VALID_PLANS[number];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gymId } = await params;
  if (!gymId) return NextResponse.json({ error: "gymId requerido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { plan_type, trial_expires_at } = body ?? {};

  if (!VALID_PLANS.includes(plan_type)) {
    return NextResponse.json({ error: "plan_type inválido. Opciones: trial, starter, crecimiento." }, { status: 400 });
  }
  if (trial_expires_at && isNaN(Date.parse(trial_expires_at))) {
    return NextResponse.json({ error: "trial_expires_at inválido." }, { status: 400 });
  }

  const gymPayload: Record<string, unknown> = { plan_type: plan_type as PlanType };
  if (trial_expires_at) gymPayload.trial_expires_at = trial_expires_at;

  const { data: currentGym } = await sb.from("gyms").select("plan_type,trial_expires_at").eq("id", gymId).maybeSingle();

  const { error: gymErr } = await sb.from("gyms").update(gymPayload).eq("id", gymId);
if (gymErr) {
  void logger.error("db error", { route: "/platform/gyms/[gymId]/plan", meta: { gymErr } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  // Mirror subscription_plan to platform_accounts via the profiles join
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("gym_id", gymId)
    .eq("role", "admin")
    .maybeSingle();

  if (profile?.id) {
    try {
      await sb
        .from("platform_accounts")
        .update({ subscription_plan: plan_type })
        .eq("auth_user_id", profile.id);
    } catch { /* best-effort mirror */ }
  }

  logPlatformAudit(sb, {
    actor_id: user.id,
    action: "plan_change",
    resource_type: "gym",
    resource_id: gymId,
    before_state: currentGym ? { plan_type: currentGym.plan_type, trial_expires_at: currentGym.trial_expires_at } : null,
    after_state: { plan_type, trial_expires_at: trial_expires_at ?? null },
  });

  return NextResponse.json({ ok: true });
}
