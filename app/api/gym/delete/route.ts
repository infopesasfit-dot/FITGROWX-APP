import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPlatformAudit } from "@/lib/platform-audit";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || profile.role !== "admin") {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // Block deletion of a gym that is active or still inside trial.
  const { data: gym } = await admin
    .from("gyms")
    .select("gym_status, is_subscription_active, trial_expires_at")
    .eq("id", gymId)
    .single();

  const hasActiveTrial = gym?.trial_expires_at
    ? new Date(gym.trial_expires_at).getTime() > Date.now()
    : false;

  if (gym?.is_subscription_active || gym?.gym_status === "active" || hasActiveTrial) {
    return NextResponse.json(
      { error: "No podés borrar un gym activo. Cancelá la suscripción o finalizá el trial primero." },
      { status: 409 },
    );
  }

  // Collect all user IDs for this gym before deleting anything
  const { data: gymUsers } = await admin
    .from("profiles")
    .select("id")
    .eq("gym_id", gymId);

  const userIds = (gymUsers ?? []).map((p: { id: string }) => p.id);

  // Delete tables without FK cascade from gyms
  await Promise.all([
    admin.from("notifications").delete().eq("gym_id", gymId),
    admin.from("asistencias").delete().eq("gym_id", gymId),
    admin.from("gym_classes").delete().eq("gym_id", gymId),
    admin.from("prospectos").delete().eq("gym_id", gymId),
    admin.from("leads").delete().eq("gym_id", gymId),
    admin.from("whatsapp_sessions").delete().eq("gym_id", gymId),
    admin.from("monthly_dashboard_reports").delete().eq("gym_id", gymId),
    admin.from("membresias").delete().eq("gym_id", gymId),
  ]);

  // Delete gyms row — cascades: alumnos, pagos, egresos, gym_cuentas, gym_promotions
  await admin.from("gyms").delete().eq("id", gymId);

  // gym_settings FK is on auth.users, delete explicitly
  await admin.from("gym_settings").delete().eq("gym_id", gymId);

  // Delete all auth users for this gym (cascades profiles via auth.users FK)
  await Promise.all(
    userIds.map((uid) => admin.auth.admin.deleteUser(uid))
  );

  logPlatformAudit(admin, {
    actor_id: user.id,
    action: "delete_gym",
    resource_type: "gym",
    resource_id: gymId,
    before_state: gym ?? null,
    after_state: null,
    meta: { deleted_by: "owner" },
  });

  return NextResponse.json({ ok: true });
}
