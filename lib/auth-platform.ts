import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const sb = getSupabaseAdminClient();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}
