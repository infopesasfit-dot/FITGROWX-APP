import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Fire-and-forget desde el dashboard layout para mantener last_seen_at actualizado.
// No bloquea render — siempre retorna 200.
export async function POST() {
  try {
    const sbUser = await createSupabaseServerClient();
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return NextResponse.json({ ok: true });

    const sb = getSupabaseAdminClient();
    const now = new Date().toISOString();

    // Intentar por auth_user_id (gyms creados con sync-signup)
    const { count } = await sb
      .from("platform_accounts")
      .update({ last_seen_at: now })
      .eq("auth_user_id", user.id)
      .select("id");

    // Fallback para gyms sin auth_user_id (registros anteriores a sync-signup)
    if (!count) {
      const { data: profile } = await sb
        .from("profiles")
        .select("gym_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.gym_id) {
        await sb
          .from("platform_accounts")
          .update({ last_seen_at: now })
          .eq("gym_id", profile.gym_id)
          .is("auth_user_id", null);
      }
    }
  } catch {
    // nunca rompe el dashboard
  }
  return NextResponse.json({ ok: true });
}
