import { NextRequest, NextResponse } from "next/server";
import { getValidAlumnoToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function GET(req: NextRequest) {
  const gym_id = new URL(req.url).searchParams.get("gym_id");
  if (!gym_id) return NextResponse.json({ error: "gym_id requerido." }, { status: 400 });
  const tokenRow = await getValidAlumnoToken(req);
  if (!tokenRow) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (tokenRow.gym_id !== gym_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

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
