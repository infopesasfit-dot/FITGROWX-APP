import { NextRequest, NextResponse } from "next/server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

const COOKIE_NAME = "impersonation_token";

export async function GET(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.redirect(new URL("/start?login=1", req.url));

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/platform", req.url));

  const sb = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: row, error } = await sb
    .from("platform_impersonation_tokens")
    .select("id, platform_user_id, expires_at")
    .eq("token", token)
    .eq("platform_user_id", actor.id)
    .eq("used", false)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    void logger.error("db error entering impersonation", {
      route: "/api/platform/impersonate/enter",
      meta: { error },
    });
    return NextResponse.redirect(new URL("/platform", req.url));
  }

  if (!row) return NextResponse.redirect(new URL("/platform", req.url));

  await sb
    .from("platform_impersonation_tokens")
    .update({ used: true, used_at: now })
    .eq("id", row.id);

  const response = NextResponse.redirect(new URL("/dashboard", req.url));
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60,
  });

  return response;
}
