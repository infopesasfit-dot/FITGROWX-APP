import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const MASTER_SECRET = process.env.MP_WEBHOOK_SECRET ?? process.env.CRON_SECRET ?? "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

function gymWebhookToken(gym_id: string): string {
  return createHmac("sha256", MASTER_SECRET).update(gym_id).digest("hex").slice(0, 32);
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["admin", "platform_owner"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const token = gymWebhookToken(profile.gym_id);
  const url = `${APP_URL}/api/mp/gym-webhook?gym_id=${profile.gym_id}&wt=${token}`;

  return NextResponse.json({ url });
}
