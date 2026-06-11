import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";

const admin = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { gymName } = await req.json().catch(() => ({}));
  if (!gymName || typeof gymName !== "string") return NextResponse.json({ ok: true });

  const { error } = await admin
    .from("platform_accounts")
    .update({ company_name: gymName.trim() })
    .eq("auth_user_id", user.id);
  if (error) {
    void logger.error("company_name sync failed", { route: "/api/gym/sync-company-name", meta: { error } });
  }

  return NextResponse.json({ ok: true });
}
