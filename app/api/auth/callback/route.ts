import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (session?.user) {
      const { user, access_token } = session;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (profile?.role === "platform_owner") {
        return NextResponse.redirect(`${origin}/platform`);
      }

      // Sincronizar datos del usuario de Google
      const fullName: string =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        "";

      await fetch(`${origin}/api/platform/sync-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ fullName, email: user.email ?? "" }),
      });

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/start`);
}
