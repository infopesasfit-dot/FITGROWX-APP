import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type ProfileSummary = { role: string | null };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );
    const { data: { session } } = await supabase.auth.exchangeCodeForSession(code);

    if (session?.user) {
      const { user, access_token } = session;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle<ProfileSummary>();

      if (profile?.role === "platform_owner") {
        return NextResponse.redirect(`${origin}/platform`);
      }

      if (!profile) {
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
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/start`);
}
