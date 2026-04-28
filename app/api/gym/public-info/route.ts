import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type GymSettingsRow = { gym_name: string | null; logo_url: string | null };

export async function GET(req: NextRequest) {
  const gym_id = new URL(req.url).searchParams.get("gym_id");
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("gym_settings")
    .select("gym_name, logo_url")
    .eq("gym_id", gym_id)
    .maybeSingle<GymSettingsRow>();

  if (!data) return NextResponse.json({ error: "Gimnasio no encontrado." }, { status: 404 });

  return NextResponse.json({ gym_name: data.gym_name ?? null, logo_url: data.logo_url ?? null });
}
