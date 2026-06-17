import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MP_CLIENT_ID = process.env.MP_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const REDIRECT_URI = `${APP_URL}/api/mp/oauth/callback`;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/dashboard/ajustes?tab=conexiones&mp_error=auth`);

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id) {
    return NextResponse.redirect(`${APP_URL}/dashboard/ajustes?tab=conexiones&mp_error=gym`);
  }

  const params = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: REDIRECT_URI,
    state: profile.gym_id,
  });

  return NextResponse.redirect(
    `https://auth.mercadopago.com/authorization?${params.toString()}`
  );
}
