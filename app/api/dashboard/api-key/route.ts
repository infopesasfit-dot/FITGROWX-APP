import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

const admin = getSupabaseAdminClient();

async function getGymId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.gym_id || profile.role !== "admin") return null;
  return profile.gym_id;
}

export async function GET() {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const { data: settings } = await admin
    .from("gym_settings")
    .select("api_key")
    .eq("gym_id", gymId)
    .maybeSingle();

  let apiKey = settings?.api_key as string | null;

  if (!apiKey) {
    apiKey = randomUUID();
    await admin
      .from("gym_settings")
      .update({ api_key: apiKey })
      .eq("gym_id", gymId);
  }

  return NextResponse.json({ ok: true, api_key: apiKey });
}

export async function DELETE() {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });

  const newKey = randomUUID();
  await admin
    .from("gym_settings")
    .update({ api_key: newKey })
    .eq("gym_id", gymId);

  return NextResponse.json({ ok: true, api_key: newKey });
}
