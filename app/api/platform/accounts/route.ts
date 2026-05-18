import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

const VALID_STATUSES = ["trial_setup", "trial_active", "trial_risk", "converted", "churned"] as const;
type AccountStatus = typeof VALID_STATUSES[number];

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

// PATCH /api/platform/accounts — update platform_account status
export async function PATCH(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { id, status } = body ?? {};

  if (!id || typeof id !== "string") return NextResponse.json({ error: "id requerido." }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "status inválido." }, { status: 400 });

  const payload: Record<string, unknown> = { status: status as AccountStatus };

  if (status === "converted") {
    payload.converted_at = new Date().toISOString();
  }
  if (status === "trial_setup" || status === "trial_active") {
    payload.trial_starts_at = new Date().toISOString();
    payload.trial_ends_at   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await sb.from("platform_accounts").update(payload).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
