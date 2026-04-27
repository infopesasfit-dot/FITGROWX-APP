import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGymSettingsSummary } from "@/lib/supabase-relations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.WA_MOTOR_API_KEY) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const motorUrl = process.env.WA_MOTOR_URL;
  const today = new Date().toISOString().slice(0, 10);
  const log: string[] = [];

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

  // ── 2. Day-13 and Day-15 WA notifications ────────────────────────────
  if (!motorUrl) return NextResponse.json({ ok: true, log: [...log, "Motor WA no configurado, notificaciones omitidas."] });

  // Use "started N+ days ago AND not yet sent" instead of exact date match.
  // This retries the next day if WA was down, so notifications are never permanently lost.
  const day13Cutoff = new Date();
  day13Cutoff.setDate(day13Cutoff.getDate() - 12);

  const day15Cutoff = new Date();
  day15Cutoff.setDate(day15Cutoff.getDate() - 14);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "fitgrowx.app";
  const waHeaders = { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" };

  async function sendTrialNotif(
    gym: { id: string; gym_settings: unknown },
    daysLeft: number,
    notifCol: "trial_notif_d13_sent_at" | "trial_notif_d15_sent_at",
  ) {
    const settings = getGymSettingsSummary(gym.gym_settings);
    const phone = settings?.whatsapp;
    const gymName = settings?.gym_name ?? "tu gimnasio";

    if (!phone) {
      log.push(`Sin WhatsApp (día ${daysLeft === 1 ? 15 : 13}): gym ${gym.id}`);
      return;
    }

    const message = daysLeft === 1
      ? `⚠️ *${gymName}* — Tu prueba de FitGrowX vence *mañana*. Pasado mañana perderás el acceso al sistema. Elegí un plan ahora en: ${appUrl}/dashboard/suscripcion`
      : `⏳ *${gymName}* — Te quedan *${daysLeft} días* de prueba gratuita en FitGrowX. No pierdas el acceso a tus alumnos y rutinas. Elegí tu plan en: ${appUrl}/dashboard/suscripcion`;

    try {
      const res = await fetch(`${motorUrl}/send/${gym.id}`, {
        method: "POST",
        headers: waHeaders,
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        await supabase.from("gyms").update({ [notifCol]: new Date().toISOString() }).eq("id", gym.id);
        log.push(`✓ Día ${daysLeft === 1 ? 15 : 13} → ${gymName}`);
      } else {
        log.push(`✗ Día ${daysLeft === 1 ? 15 : 13} → ${gymName} (HTTP ${res.status}, se reintentará)`);
      }
    } catch (err) {
      log.push(`✗ Día ${daysLeft === 1 ? 15 : 13} → ${gymName} — ${err instanceof Error ? err.message : "error"} (se reintentará)`);
    }
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
  }

  return NextResponse.json({ ok: true, date: today, log });
}
