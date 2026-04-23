import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const gym_id = new URL(req.url).searchParams.get("gym_id");
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });

  const [{ data: settings }, { data: gym }] = await Promise.all([
    supabase.from("gym_settings").select("gym_name, logo_url, accent_color").eq("gym_id", gym_id).single(),
    supabase.from("gyms").select("plan_type").eq("id", gym_id).single(),
  ]);

  return NextResponse.json({
    gym_name:   settings?.gym_name   ?? null,
    logo_url:   settings?.logo_url   ?? null,
    accent_color: settings?.accent_color ?? null,
    plan_type:  gym?.plan_type ?? null,
  });
}
