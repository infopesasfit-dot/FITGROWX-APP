import type { SupabaseClient } from "@supabase/supabase-js";

export async function aggregateWaMetrics(supabase: SupabaseClient): Promise<void> {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);

  const { data: logs } = await supabase
    .from("wa_mensajes_log")
    .select("status, latency_ms")
    .gte("sent_at", hourAgo.toISOString())
    .lt("sent_at", now.toISOString());

  if (!logs || logs.length === 0) return;

  const totalSent = logs.length;
  const totalBlocked = logs.filter(l => l.status === "blocked").length;
  const totalFailed = logs.filter(l => l.status === "failed").length;
  const avgLatency = Math.round(
    logs.reduce((sum, l) => sum + (l.latency_ms ?? 0), 0) / logs.length
  );
  const blockRatio = (totalBlocked / totalSent) * 100;

  await supabase.from("wa_platform_metrics").insert({
    period_start: hourAgo.toISOString(),
    period_end: now.toISOString(),
    total_sent: totalSent,
    total_blocked: totalBlocked,
    total_failed: totalFailed,
    avg_latency_ms: avgLatency,
    block_ratio: Math.round(blockRatio * 100) / 100,
  });
}

export async function clearExpiredCooldowns(supabase: SupabaseClient): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("wa_contact_metrics")
    .update({ cooldown_until: null })
    .lt("cooldown_until", now)
    .not("cooldown_until", "is", null);
}
