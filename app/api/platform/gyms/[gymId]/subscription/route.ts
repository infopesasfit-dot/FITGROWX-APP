import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";

const sb = getSupabaseAdminClient();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ gymId: string }> }) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gymId } = await params;
  if (!gymId) return NextResponse.json({ error: "gymId requerido." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const { active } = body ?? {};
  if (typeof active !== "boolean") return NextResponse.json({ error: "active (boolean) requerido." }, { status: 400 });

  const { error } = await sb
    .from("gyms")
    .update({
      is_subscription_active: active,
      gym_status: active ? "active" : "cancelled",
    })
    .eq("id", gymId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sb.from("platform_logs").insert({
      level: "INFO",
      route: "platform/gyms/subscription",
      message: `Subscription ${active ? "activated" : "deactivated"} for gym ${gymId} by platform_owner ${user.id}`,
      meta: { gym_id: gymId, active, actor: user.id },
    });
  } catch { /* best-effort log */ }

  return NextResponse.json({ ok: true });
}
