import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code     = searchParams.get("code");
  const next     = searchParams.get("next") ?? "/";
  const error    = searchParams.get("error");

  if (error) return NextResponse.redirect(`${origin}/start?error=${error}`);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error: exchError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchError) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/start`);
}
