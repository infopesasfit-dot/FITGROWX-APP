import type { SupabaseClient } from "@supabase/supabase-js";

const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

export function isWithinAllowedWindow(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [time] = formatter.formatToParts(now).reduce((acc, part) => {
    if (part.type === "hour") acc[0] = part.value;
    if (part.type === "minute") acc[1] = part.value;
    return acc;
  }, ["00", "00"]);

  const hour = parseInt(time[0], 10);
  const minute = parseInt(time[1], 10);
  const currentMinutes = hour * 60 + minute;

  // 10:00 - 13:00 (600 - 780)
  // 15:00 - 19:00 (900 - 1140)
  const window1Start = 10 * 60;
  const window1End = 13 * 60;
  const window2Start = 15 * 60;
  const window2End = 19 * 60;

  return (currentMinutes >= window1Start && currentMinutes < window1End) ||
         (currentMinutes >= window2Start && currentMinutes < window2End);
}

export async function checkWaContactCooldown(
  supabase: SupabaseClient,
  gymId: string,
  alumnoId: string,
): Promise<{ allowed: boolean; reason?: string; cooldownUntil?: string }> {
  const { data } = await supabase
    .from("wa_contact_metrics")
    .select("cooldown_until, blocked_count")
    .eq("gym_id", gymId)
    .eq("alumno_id", alumnoId)
    .maybeSingle();

  if (!data) return { allowed: true };

  if (data.cooldown_until) {
    const now = new Date();
    const cooldownUntil = new Date(data.cooldown_until);
    if (now < cooldownUntil) {
      const minutesLeft = Math.ceil((cooldownUntil.getTime() - now.getTime()) / 60000);
      return {
        allowed: false,
        reason: `En cooldown. Reintentar en ${minutesLeft}m`,
        cooldownUntil: data.cooldown_until,
      };
    }
  }

  return { allowed: true };
}

export async function getWaPlatformHealth(
  supabase: SupabaseClient,
  hours: number = 24,
): Promise<{ blockRatio: number; avgLatency: number; totalSent: number }> {
  const since = new Date(Date.now() - hours * 3600000).toISOString();

  const { data: logs } = await supabase
    .from("wa_mensajes_log")
    .select("status, latency_ms")
    .gte("sent_at", since);

  if (!logs || logs.length === 0) {
    return { blockRatio: 0, avgLatency: 0, totalSent: 0 };
  }

  const blocked = logs.filter(l => l.status === "blocked").length;
  const blockRatio = (blocked / logs.length) * 100;
  const avgLatency = Math.round(
    logs.reduce((sum, l) => sum + (l.latency_ms ?? 0), 0) / logs.length
  );

  return {
    blockRatio: Math.round(blockRatio * 100) / 100,
    avgLatency,
    totalSent: logs.length,
  };
}
