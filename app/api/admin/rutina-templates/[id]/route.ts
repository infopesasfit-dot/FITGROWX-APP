import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<{ gym_id: string | null; role: string | null }>();
  if (!profile?.gym_id || !["admin", "staff"].includes(profile.role ?? "")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const { error } = await supabase
    .from("rutina_templates")
    .delete()
    .eq("id", id)
    .eq("gym_id", profile.gym_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
