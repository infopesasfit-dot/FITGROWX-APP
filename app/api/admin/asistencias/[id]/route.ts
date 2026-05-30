import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

const sb = getSupabaseAdminClient();

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; gym_id: string | null }>();

  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const blocked = await requireGymNotBlocked(profile.gym_id);
  if (blocked) return blocked;

  // Verify row belongs to this gym before deleting
  const { data: row } = await sb
    .from("asistencias")
    .select("id")
    .eq("id", id)
    .eq("gym_id", profile.gym_id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Asistencia no encontrada." }, { status: 404 });

  await sb.from("asistencias").delete().eq("id", id);

  return NextResponse.json({ ok: true });
}
