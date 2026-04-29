import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuthorizedProfile = {
  id: string;
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

function adminClient() {
  return getSupabaseAdminClient();
}

async function getAuthorizedProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  return profile ?? null;
}

// GET /api/notifications?gym_id=xxx — fetch last 30 notifications
export async function GET(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");
  if (!gymId) return NextResponse.json({ error: "gym_id required" }, { status: 400 });
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (profile.role !== "platform_owner" && profile.gym_id !== gymId) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const supabase = adminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data });
}

// PATCH /api/notifications — mark all as read for a gym
export async function PATCH(req: NextRequest) {
  const { gym_id } = await req.json();
  if (!gym_id) return NextResponse.json({ error: "gym_id required" }, { status: 400 });
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (profile.role !== "platform_owner" && profile.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const supabase = adminClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("gym_id", gym_id)
    .eq("read", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// POST /api/notifications — create a notification (internal use)
export async function POST(req: NextRequest) {
  const { gym_id, type, title, body } = await req.json();
  if (!gym_id || !type || !title) {
    return NextResponse.json({ error: "gym_id, type, title required" }, { status: 400 });
  }
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (profile.role !== "platform_owner" && profile.gym_id !== gym_id) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const supabase = adminClient();
  const { error } = await supabase
    .from("notifications")
    .insert([{ gym_id, type, title, body: body ?? null }]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
