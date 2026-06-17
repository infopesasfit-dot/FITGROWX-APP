import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MP_CLIENT_ID = process.env.MP_CLIENT_ID!;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/mp/oauth/callback`;
const RETURN_URL = `${APP_URL}/dashboard/ajustes?tab=conexiones`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // gym_id
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(`${RETURN_URL}&mp_error=cancelled`);
  }

  // Verify user session
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${RETURN_URL}&mp_error=auth`);

  // Verify state matches the authenticated user's gym
  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || profile.gym_id !== state) {
    return NextResponse.redirect(`${RETURN_URL}&mp_error=state`);
  }

  // Exchange code for access_token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error("[MP OAuth] token exchange failed", tokenRes.status, await tokenRes.text());
      return NextResponse.redirect(`${RETURN_URL}&mp_error=token`);
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    if (!accessToken) return NextResponse.redirect(`${RETURN_URL}&mp_error=token`);
  } catch (err) {
    console.error("[MP OAuth] fetch error", err);
    return NextResponse.redirect(`${RETURN_URL}&mp_error=token`);
  }

  // Save token to gym_settings
  const { error: dbError } = await admin
    .from("gym_settings")
    .upsert({ gym_id: profile.gym_id, mp_access_token: accessToken }, { onConflict: "gym_id" });

  if (dbError) {
    console.error("[MP OAuth] db upsert failed", dbError);
    return NextResponse.redirect(`${RETURN_URL}&mp_error=db`);
  }

  return NextResponse.redirect(`${RETURN_URL}&mp=connected`);
}
