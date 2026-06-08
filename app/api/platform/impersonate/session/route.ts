import { NextRequest, NextResponse } from "next/server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const COOKIE_NAME = "impersonation_token";

export async function GET(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ active: false }, { status: 401 });

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ active: false });

  const sb = getSupabaseAdminClient();
  const { data: row } = await sb
    .from("platform_impersonation_tokens")
    .select("target_gym_id, target_user_id, expires_at")
    .eq("token", token)
    .eq("platform_user_id", actor.id)
    .eq("used", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!row) return NextResponse.json({ active: false });

  const { data: settings } = await sb
    .from("gym_settings")
    .select("gym_name")
    .eq("gym_id", row.target_gym_id)
    .maybeSingle();

  return NextResponse.json({
    active: true,
    gym_id: row.target_gym_id,
    gym_name: settings?.gym_name ?? "Gym",
    target_user_id: row.target_user_id,
    expires_at: row.expires_at,
  });
}
