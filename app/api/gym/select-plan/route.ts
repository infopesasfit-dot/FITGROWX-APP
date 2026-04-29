import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const { gym_id, plan_type } = await req.json();

  if (!gym_id || !["gestion", "crecimiento", "full_marca"].includes(plan_type)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  const supabaseServer = await createSupabaseServerClient();
  const { data: { user } } = await supabaseServer.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  if (profile.role !== "platform_owner" && profile.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const { error } = await supabase
    .from("gyms")
    .update({ plan_type })
    .eq("id", gym_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
