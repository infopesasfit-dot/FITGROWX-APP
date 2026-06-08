import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logPlatformAudit } from "@/lib/platform-audit";
import { logger } from "@/lib/logger";

const sb = getSupabaseAdminClient();

const VALID_STATUSES = ["trial_setup", "trial_active", "trial_risk", "converted", "churned"] as const;
type AccountStatus = typeof VALID_STATUSES[number];

// PATCH /api/platform/accounts — update platform_account status
export async function PATCH(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { id, status, trial_ends_at } = body ?? {};

  if (!id || typeof id !== "string") return NextResponse.json({ error: "id requerido." }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: "status inválido." }, { status: 400 });

  // Fetch current row for before_state and gym_id resolution
  const { data: current } = await sb
    .from("platform_accounts")
    .select("status, trial_starts_at, trial_ends_at, converted_at, gym_id")
    .eq("id", id)
    .maybeSingle();

  const payload: Record<string, unknown> = { status: status as AccountStatus };

  if (status === "converted") {
    payload.converted_at = new Date().toISOString();
  }
  if (status === "trial_setup" || status === "trial_active") {
    payload.trial_starts_at = new Date().toISOString();
    payload.trial_ends_at   = trial_ends_at
      ? new Date(trial_ends_at).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await sb.from("platform_accounts").update(payload).eq("id", id);
if (error) {
  void logger.error("db error", { route: "/platform/accounts", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  // Sync gyms.trial_expires_at when extending a trial
  const gymId = current?.gym_id;
  let gymSyncWarning: string | undefined;
  if (gymId && (status === "trial_setup" || status === "trial_active") && payload.trial_ends_at) {
    const { error: gymError } = await sb
      .from("gyms")
      .update({ trial_expires_at: payload.trial_ends_at })
      .eq("id", gymId);
    if (gymError) {
      void logger.error("gym sync failed on extend trial", { route: "/platform/accounts", meta: { gymId, error: gymError } });
      gymSyncWarning = "trial actualizado en CRM pero no se pudo sincronizar el gym";
    }
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "extend_trial",
    resource_type: "platform_account",
    resource_id: id,
    before_state: current ?? null,
    after_state: { ...payload, gym_id: gymId ?? null },
  });

  return NextResponse.json(gymSyncWarning ? { ok: true, warning: gymSyncWarning } : { ok: true });
}

// DELETE /api/platform/accounts?id=<uuid>[&permanent=true]
export async function DELETE(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id        = req.nextUrl.searchParams.get("id");
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";
  if (!id) return NextResponse.json({ error: "id requerido." }, { status: 400 });

  const { data: accountBefore } = await sb.from("platform_accounts").select("status, company_name, owner_name, email, auth_user_id, gym_id").eq("id", id).maybeSingle();
  const warnings: string[] = [];

  if (permanent) {
    // Require explicit confirmation in the body for irreversible deletion
    const { confirm_delete } = await req.json().catch(() => ({}));
    if (confirm_delete !== "CONFIRMAR_BORRADO_PERMANENTE") {
      return NextResponse.json({ error: "Se requiere confirmación explícita" }, { status: 400 });
    }

    // Resolve gym_id via auth_user_id on the account
    const { data: account } = await sb.from("platform_accounts").select("auth_user_id").eq("id", id).maybeSingle();
    const authUserId = account?.auth_user_id;

    if (authUserId) {
      const { data: profileRow } = await sb.from("profiles").select("gym_id").eq("id", authUserId).maybeSingle();
      const gymId = profileRow?.gym_id;

      if (gymId) {
        // Block permanent deletion of a gym with an active subscription/status/trial
        const { data: gym } = await sb.from("gyms").select("gym_status, is_subscription_active, trial_expires_at").eq("id", gymId).single();
        const hasActiveTrial = gym?.trial_expires_at
          ? new Date(gym.trial_expires_at).getTime() > Date.now()
          : false;
        if (gym?.is_subscription_active || gym?.gym_status === "active" || hasActiveTrial) {
          return NextResponse.json({ error: "No se puede borrar un gym activo" }, { status: 409 });
        }

        // All user IDs for this gym (to delete auth users after)
        const { data: gymUsers } = await sb.from("profiles").select("id").eq("gym_id", gymId);
        const userIds = (gymUsers ?? []).map((p: { id: string }) => p.id);

        const permanentDeletes = [
          { table: "notifications", query: () => sb.from("notifications").delete().eq("gym_id", gymId) },
          { table: "asistencias", query: () => sb.from("asistencias").delete().eq("gym_id", gymId) },
          { table: "gym_classes", query: () => sb.from("gym_classes").delete().eq("gym_id", gymId) },
          { table: "prospectos", query: () => sb.from("prospectos").delete().eq("gym_id", gymId) },
          { table: "leads", query: () => sb.from("leads").delete().eq("gym_id", gymId) },
          { table: "whatsapp_sessions", query: () => sb.from("whatsapp_sessions").delete().eq("gym_id", gymId) },
          { table: "monthly_dashboard_reports", query: () => sb.from("monthly_dashboard_reports").delete().eq("gym_id", gymId) },
          { table: "membresias", query: () => sb.from("membresias").delete().eq("gym_id", gymId) },
        ];

        for (const item of permanentDeletes) {
          const { error: deleteError } = await item.query();
          if (deleteError) {
            warnings.push("algunos datos pueden no haberse eliminado completamente");
            void logger.error("partial permanent delete failed", {
              route: "/platform/accounts",
              meta: { table: item.table, gymId, error: deleteError },
            });
          }
        }

        // Deletes alumnos, pagos, egresos, gym_cuentas, gym_promotions via cascade
        const { error: gymDeleteError } = await sb.from("gyms").delete().eq("id", gymId);
        if (gymDeleteError) {
          warnings.push("algunos datos pueden no haberse eliminado completamente");
          void logger.error("partial permanent delete failed", {
            route: "/platform/accounts",
            meta: { table: "gyms", gymId, error: gymDeleteError },
          });
        }

        const { error: settingsDeleteError } = await sb.from("gym_settings").delete().eq("gym_id", gymId);
        if (settingsDeleteError) {
          warnings.push("algunos datos pueden no haberse eliminado completamente");
          void logger.error("partial permanent delete failed", {
            route: "/platform/accounts",
            meta: { table: "gym_settings", gymId, error: settingsDeleteError },
          });
        }

        for (const uid of userIds) {
          const { error: userDeleteError } = await sb.auth.admin.deleteUser(uid);
          if (userDeleteError) {
            warnings.push("algunos datos pueden no haberse eliminado completamente");
            void logger.error("partial permanent delete failed", {
              route: "/platform/accounts",
              meta: { table: "auth.users", userId: uid, error: userDeleteError },
            });
          }
        }
      }
    }
  }

  // Always remove the CRM row itself
  const { error } = await sb.from("platform_accounts").delete().eq("id", id);
if (error) {
  void logger.error("db error", { route: "/platform/accounts", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  logPlatformAudit(sb, {
    actor_id: actor.id,
    action: "delete_account",
    resource_type: "platform_account",
    resource_id: id,
    before_state: accountBefore ?? null,
    after_state: { permanent },
  });

  return warnings.length > 0
    ? NextResponse.json({ ok: true, warnings: Array.from(new Set(warnings)) })
    : NextResponse.json({ ok: true });
}
