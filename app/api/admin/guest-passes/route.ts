import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

const sb = getSupabaseAdminClient();

async function getGymId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const user = await requireUser();
  if (!user) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<{ gym_id: string | null; role: string | null }>();
  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) return null;
  return profile.gym_id;
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

  const blocked = await requireGymNotBlocked(gymId);
  if (blocked) return blocked;

  const { passId } = await req.json();

  await sb.from("guest_passes")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", passId)
    .eq("gym_id", gymId);

  return NextResponse.json({ ok: true });
}
