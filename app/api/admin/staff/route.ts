import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient , requireUser } from "@/lib/supabase-server";
import { createStaffSchema, parseBody } from "@/lib/schemas";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

type AdminProfile = {
  gym_id: string | null;
  role: "admin" | "staff" | string | null;
};

const supabaseAdmin = getSupabaseAdminClient();

async function getAdminGymId(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const user = await requireUser();
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

  const blocked = await requireGymNotBlocked(admin.gymId);
  if (blocked) return blocked;

  const raw = await req.json();
  const parsed = parseBody(createStaffSchema, raw);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });

  const { email, password, full_name } = parsed.data;

  const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return NextResponse.json({ ok: false, error: authError.message }, { status: 400 });

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: newUser.user.id,
    gym_id: admin.gymId,
    role: "staff",
    email,
    full_name: full_name ?? null,
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

  const blocked = await requireGymNotBlocked(admin.gymId);
  if (blocked) return blocked;

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
