import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getGymPlanStatus } from "@/lib/gym-plan-status";

const admin = getSupabaseAdminClient();

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (!profile?.gym_id) {
    return NextResponse.json({ ok: false, error: "Sin gym asignado." }, { status: 403 });
  }

  const plan = await getGymPlanStatus(profile.gym_id);
  return NextResponse.json({ ok: true, ...plan });
}
