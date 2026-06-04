import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";
import { logger } from "@/lib/logger";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const { gym_id, plan_type } = await req.json();

  const validKeys = FITGROWX_PLANS.map((p) => p.key);
  if (!gym_id || !validKeys.includes(plan_type)) {
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
  // Solo platform_owner puede cambiar el plan directamente (sin pago)
  if (profile.role !== "platform_owner") {
    return NextResponse.json({ error: "Solo la plataforma puede cambiar el plan directamente." }, { status: 403 });
  }

  const { error } = await supabase
    .from("gyms")
    .update({ plan_type })
    .eq("id", gym_id);

if (error) {
  void logger.error("db error", { route: "/gym/select-plan", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
