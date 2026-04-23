import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

  // Gyms where trial_start_date + 12 = today (day 13, 3 days left)
  // Gyms where trial_start_date + 14 = today (day 15, 1 day left)
  const day13Date = new Date();
  day13Date.setDate(day13Date.getDate() - 12);

  const day15Date = new Date();
  day15Date.setDate(day15Date.getDate() - 14);

  const { data: gymsToNotify } = await supabase
    .from("gyms")
    .select("id, trial_start_date, trial_expires_at, gym_settings(gym_name, whatsapp)")
    .eq("gym_status", "trial")
    .eq("is_subscription_active", false)
    .in("trial_start_date", [
      day13Date.toISOString().slice(0, 10),
      day15Date.toISOString().slice(0, 10),
    ]);

  for (const gym of gymsToNotify ?? []) {
    const settings = gym.gym_settings as { gym_name: string | null; whatsapp: string | null } | null;
    const phone = settings?.whatsapp;
    const gymName = settings?.gym_name ?? "tu gimnasio";

    if (!phone) {
      log.push(`Sin WhatsApp: gym ${gym.id}`);
      continue;
    }

    const isDay15 = gym.trial_start_date === day15Date.toISOString().slice(0, 10);
    const daysLeft = isDay15 ? 1 : 3;

    const message = isDay15
      ? `⚠️ *${gymName}* — Tu prueba de FitGrowX vence *mañana*. Pasado mañana perderás el acceso al sistema. Elegí un plan ahora en: ${process.env.NEXT_PUBLIC_APP_URL ?? "fitgrowx.app"}/dashboard/suscripcion`
      : `⏳ *${gymName}* — Te quedan *${daysLeft} días* de prueba gratuita en FitGrowX. No pierdas el acceso a tus alumnos y rutinas. Elegí tu plan en: ${process.env.NEXT_PUBLIC_APP_URL ?? "fitgrowx.app"}/dashboard/suscripcion`;

    try {
      const res = await fetch(`${motorUrl}/send/${gym.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
        body: JSON.stringify({ phone, message }),
        signal: AbortSignal.timeout(8000),
      });
      log.push(`${res.ok ? "✓" : "✗"} Día ${isDay15 ? 15 : 13} → ${gymName} (${phone})`);
    } catch (err) {
      log.push(`✗ ${gymName} — ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return NextResponse.json({ ok: true, date: today, log });
}
