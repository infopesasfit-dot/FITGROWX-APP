import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGymSettingsSummary } from "@/lib/supabase-relations";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const log: string[] = [];
  let d13Sent = 0;
  let d15Sent = 0;

  try {

  // ── 1. Mark trial_expired gyms ────────────────────────────────────────
  const { data: expired, error: expErr } = await supabase
    .from("gyms")
    .update({ gym_status: "trial_expired" })
    .eq("gym_status", "trial")
    .eq("is_subscription_active", false)
    .lt("trial_expires_at", new Date().toISOString())
    .select("id");

  if (expErr) log.push(`Error marcando expirados: ${expErr.message}`);
  else log.push(`Marcados como trial_expired: ${expired?.length ?? 0}`);

  // ── 1b. Expirar suscripciones pagas vencidas (red de seguridad) ───────
  // Si subscription_expires_at quedó en el pasado pero el booleano sigue en true
  // (plan anual sin evento de baja, o webhook de cancelación perdido), bajamos el
  // acceso. El webhook de MP sigue siendo la vía principal; esto evita fugas.
  const { data: subExpired, error: subErr } = await supabase
    .from("gyms")
    .update({ is_subscription_active: false, gym_status: "cancelled" })
    .eq("is_subscription_active", true)
    .in("plan_type", ["starter", "crecimiento"])
    .lt("subscription_expires_at", new Date().toISOString())
    .select("id");

  if (subErr) log.push(`Error expirando suscripciones pagas: ${subErr.message}`);
  else log.push(`Suscripciones pagas expiradas: ${subExpired?.length ?? 0}`);

  // ── 2. Day-13 and Day-15 WA notifications ────────────────────────────
  // Use "started N+ days ago AND not yet sent" instead of exact date match.
  // This retries the next day if WA was down, so notifications are never permanently lost.
  const day13Cutoff = new Date();
  day13Cutoff.setDate(day13Cutoff.getDate() - 12);

  const day15Cutoff = new Date();
  day15Cutoff.setDate(day15Cutoff.getDate() - 14);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

  async function sendTrialNotif(
    gym: { id: string; gym_settings: unknown },
    daysLeft: number,
    notifCol: "trial_notif_d13_sent_at" | "trial_notif_d15_sent_at",
  ) {
    const settings = getGymSettingsSummary(gym.gym_settings);
    const rawPhone = settings?.whatsapp;
    const gymName = settings?.gym_name ?? "tu gimnasio";

    if (!rawPhone) {
      log.push(`Sin WhatsApp (día ${daysLeft === 1 ? 15 : 13}): gym ${gym.id}`);
      return;
    }

    const phone = normalizePhone(rawPhone);
    const message = daysLeft === 1
      ? `⚠️ *${gymName}* — Tu prueba de FitGrowX vence *mañana*. Pasado mañana perderás el acceso al sistema. Elegí un plan ahora en: ${appUrl}/dashboard/suscripcion`
      : `⏳ *${gymName}* — Te quedan *${daysLeft} días* de prueba gratuita en FitGrowX. No pierdas el acceso a tus alumnos y rutinas. Elegí tu plan en: ${appUrl}/dashboard/suscripcion`;

    await Promise.all([
      supabase.from("gyms").update({ [notifCol]: new Date().toISOString() }).eq("id", gym.id),
      supabase.from("notifications").insert({
        gym_id: gym.id,
        type: "trial_warning",
        title: daysLeft === 1 ? "⚠️ Tu prueba vence mañana" : `⏳ ${daysLeft} días de prueba restantes`,
        body: daysLeft === 1
          ? "Mañana perdés el acceso. Activá tu plan ahora para no interrumpir tu operación."
          : `En ${daysLeft} días perdés acceso a alumnos, cobros y automatizaciones.`,
        link: "/dashboard/planes",
      }),
    ]);
    void sendWa(gym.id, phone, message, { route: "cron/trial-check" });
    log.push(`✓ Día ${daysLeft === 1 ? 15 : 13} → ${gymName}`);
  }

  // Day 13 (3 days left): started 12+ days ago, d13 not sent yet
  const { data: d13Gyms } = await supabase
    .from("gyms")
    .select("id, gym_settings(gym_name, whatsapp)")
    .eq("gym_status", "trial")
    .eq("is_subscription_active", false)
    .lte("trial_start_date", day13Cutoff.toISOString().slice(0, 10))
    .is("trial_notif_d13_sent_at", null);

  for (const gym of d13Gyms ?? []) {
    await sendTrialNotif(gym, 3, "trial_notif_d13_sent_at");
    d13Sent++;
  }

  // Day 15 (1 day left): started 14+ days ago, d15 not sent yet
  const { data: d15Gyms } = await supabase
    .from("gyms")
    .select("id, gym_settings(gym_name, whatsapp)")
    .eq("gym_status", "trial")
    .eq("is_subscription_active", false)
    .lte("trial_start_date", day15Cutoff.toISOString().slice(0, 10))
    .is("trial_notif_d15_sent_at", null);

  for (const gym of d15Gyms ?? []) {
    await sendTrialNotif(gym, 1, "trial_notif_d15_sent_at");
    d15Sent++;
  }

  const trialExpiredCount = expired?.length ?? 0;
  const subExpiredCount = subExpired?.length ?? 0;
  void supabase.from("cron_runs").insert({ cron_name: "trial-check", status: "ok", duration_ms: Date.now() - startedAt, summary: `${today} · ${trialExpiredCount} expirados, ${subExpiredCount} subs, ${d13Sent + d15Sent} notifs WA`, counts: { trialExpired: trialExpiredCount, subExpired: subExpiredCount, d13Sent, d15Sent, log } });
  return NextResponse.json({ ok: true, date: today, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void supabase.from("cron_runs").insert({ cron_name: "trial-check", status: "error", duration_ms: Date.now() - startedAt, summary: msg });
    console.error("[trial-check] error fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
