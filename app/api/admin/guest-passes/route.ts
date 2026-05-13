import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

async function getGymId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("gym_id").eq("id", user.id).maybeSingle();
  return profile?.gym_id ?? null;
}

export async function GET() {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: passes } = await sb
    .from("guest_passes")
    .select("id, token, code, status, lead_name, lead_phone, claimed_at, used_at, expires_at, alumno_id, alumnos(full_name)")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ passes: passes ?? [] });
}

export async function PATCH(req: NextRequest) {
  const gymId = await getGymId();
  if (!gymId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { passId } = await req.json();

  await sb.from("guest_passes")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", passId)
    .eq("gym_id", gymId);

  return NextResponse.json({ ok: true });
}
