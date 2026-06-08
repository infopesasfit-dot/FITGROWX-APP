import { NextRequest, NextResponse } from "next/server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPlatformAudit } from "@/lib/platform-audit";

const COOKIE_NAME = "impersonation_token";

export async function POST(req: NextRequest) {
  const actor = await assertPlatformOwner();
  const token = req.cookies.get(COOKIE_NAME)?.value ?? null;

  if (actor && token) {
    const sb = getSupabaseAdminClient();
    const { data: row } = await sb
      .from("platform_impersonation_tokens")
      .select("target_gym_id, target_user_id")
      .eq("token", token)
      .eq("platform_user_id", actor.id)
      .maybeSingle();

    if (row) {
      logPlatformAudit(sb, {
        actor_id: actor.id,
        action: "impersonation_stop",
        resource_type: "gym",
        resource_id: row.target_gym_id,
        after_state: {
          gym_id: row.target_gym_id,
          target_user_id: row.target_user_id,
        },
      });
    }
  }

  const response = NextResponse.redirect(new URL("/platform", req.url));
  response.cookies.delete(COOKIE_NAME);
  return response;
}
