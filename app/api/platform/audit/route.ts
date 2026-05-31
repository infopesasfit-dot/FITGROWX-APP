import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";

const sb = getSupabaseAdminClient();

const VALID_ACTIONS = ["impersonate_start", "impersonate_stop"] as const;

export async function POST(req: NextRequest) {
  const user = await assertPlatformOwner();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { action, gym_id, gym_name } = body ?? {};

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "action inválido." }, { status: 400 });
  }
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });

  logPlatformAudit(sb, {
    actor_id: user.id,
    action,
    resource_type: "gym",
    resource_id: gym_id,
    meta: { gym_name: gym_name ?? null },
  });

  return NextResponse.json({ ok: true });
}
