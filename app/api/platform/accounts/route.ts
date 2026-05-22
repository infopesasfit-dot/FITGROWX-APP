import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";

const sb = getSupabaseAdminClient();

const VALID_STATUSES = ["trial_setup", "trial_active", "trial_risk", "converted", "churned"] as const;
type AccountStatus = typeof VALID_STATUSES[number];

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

// DELETE /api/platform/accounts?id=<uuid>[&permanent=true]
export async function DELETE(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id        = req.nextUrl.searchParams.get("id");
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";
  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  if (permanent) {
    // Resolve gym_id via auth_user_id on the account
    const { data: account } = await sb.from("platform_accounts").select("auth_user_id").eq("id", id).maybeSingle();
    const authUserId = account?.auth_user_id;

    if (authUserId) {
      const { data: profileRow } = await sb.from("profiles").select("gym_id").eq("id", authUserId).maybeSingle();
      const gymId = profileRow?.gym_id;

      if (gymId) {
        // All user IDs for this gym (to delete auth users after)
        const { data: gymUsers } = await sb.from("profiles").select("id").eq("gym_id", gymId);
        const userIds = (gymUsers ?? []).map((p: { id: string }) => p.id);

        await Promise.all([
          sb.from("notifications").delete().eq("gym_id", gymId),
          sb.from("asistencias").delete().eq("gym_id", gymId),
          sb.from("gym_classes").delete().eq("gym_id", gymId),
          sb.from("prospectos").delete().eq("gym_id", gymId),
          sb.from("leads").delete().eq("gym_id", gymId),
          sb.from("whatsapp_sessions").delete().eq("gym_id", gymId),
          sb.from("monthly_dashboard_reports").delete().eq("gym_id", gymId),
          sb.from("membresias").delete().eq("gym_id", gymId),
        ]);

        // Deletes alumnos, pagos, egresos, gym_cuentas, gym_promotions via cascade
        await sb.from("gyms").delete().eq("id", gymId);
        await sb.from("gym_settings").delete().eq("gym_id", gymId);

        await Promise.all(userIds.map((uid) => sb.auth.admin.deleteUser(uid)));
      }
    }
  }

  // Always remove the CRM row itself
  const { error } = await sb.from("platform_accounts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
