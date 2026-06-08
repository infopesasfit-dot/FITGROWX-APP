import { NextRequest, NextResponse } from "next/server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

const TOKEN_TTL_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { gym_id } = (await req.json().catch(() => null)) ?? {};
  if (!gym_id || typeof gym_id !== "string") {
    return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });
  }

  const sb = getSupabaseAdminClient();

  const { data: owner, error: ownerError } = await sb
    .from("profiles")
    .select("id")
    .eq("gym_id", gym_id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (ownerError) {
    void logger.error("db error resolving impersonation owner", {
      route: "/api/platform/impersonate",
      meta: { ownerError, gym_id },
    });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  if (!owner?.id) {
    return NextResponse.json({ error: "No se encontró owner admin para este gym." }, { status: 404 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: insertError } = await sb.from("platform_impersonation_tokens").insert({
    platform_user_id: actor.id,
    target_gym_id: gym_id,
    target_user_id: owner.id,
    token,
    expires_at: expiresAt,
  });

  if (insertError) {
    void logger.error("db error creating impersonation token", {
      route: "/api/platform/impersonate",
      meta: { insertError, gym_id },
    });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "impersonation_start",
    resource_type: "gym",
    resource_id: gym_id,
    after_state: {
      gym_id,
      target_user_id: owner.id,
      expires_at: expiresAt,
    },
  });

  return NextResponse.json({ token });
}
