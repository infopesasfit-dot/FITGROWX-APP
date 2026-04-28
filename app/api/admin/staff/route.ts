import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AdminProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | string | null;
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAdminGymId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("gym_id, role").eq("id", user.id).maybeSingle<AdminProfile>();
  const profileRow = profile as AdminProfile | null;
  if (!profileRow || profileRow.role !== "admin") return null;
  return { userId: user.id, gymId: profileRow.gym_id as string };
}

// GET — listar staff del gym
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const admin = await getAdminGymId(supabase);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("gym_id", admin.gymId)
    .eq("role", "staff")
    .order("full_name");

  return NextResponse.json({ ok: true, staff: data ?? [] });
}

// POST — crear nuevo staff
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = await getAdminGymId(supabase);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { email, password, full_name } = await req.json() as { email: string; password: string; full_name?: string };
  if (!email?.trim() || !password || password.length < 6) {
    return NextResponse.json({ ok: false, error: "Email y contraseña (mín. 6 caracteres) son obligatorios." }, { status: 400 });
  }

  const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  });
  if (authError) return NextResponse.json({ ok: false, error: authError.message }, { status: 400 });

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUser.user.id,
    gym_id: admin.gymId,
    role: "staff",
    email: email.trim().toLowerCase(),
    full_name: full_name?.trim() || null,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: newUser.user.id });
}

// DELETE — eliminar staff
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const admin = await getAdminGymId(supabase);
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const { id } = await req.json() as { id: string };
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

  const { data: staffProfile } = await supabaseAdmin
    .from("profiles").select("gym_id, role").eq("id", id).maybeSingle<AdminProfile>();
  const staffProfileRow = staffProfile as AdminProfile | null;
  if (!staffProfileRow || staffProfileRow.gym_id !== admin.gymId || staffProfileRow.role !== "staff") {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  await supabaseAdmin.from("profiles").delete().eq("id", id);
  await supabaseAdmin.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
