import type { SupabaseClient } from "@supabase/supabase-js";

export interface WaHealthMetrics {
  status: "connected" | "limited" | "blocked";
  last24h: {
    sent: number;
    blocked: number;
    bounces: number;
    failed: number;
    avgLatency: number;
    blockRatio: number;
  };
  recentEvents: Array<{
    id: string;
    type: string;
    phone: string;
    reason?: string;
    createdAt: string;
  }>;
  alerts: Array<{
    level: "warning" | "critical";
    message: string;
    timestamp: string;
  }>;
}

export async function getWaHealthMetrics(supabase: SupabaseClient): Promise<WaHealthMetrics> {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 3600000).toISOString();

  // Get message stats
  const { data: logs } = await supabase
    .from("wa_mensajes_log")
    .select("status, latency_ms")
    .gte("sent_at", since24h);

  const sent = logs?.length || 0;
  const blocked = logs?.filter(l => l.status === "blocked").length || 0;
  const bounces = logs?.filter(l => l.status === "failed").length || 0;
  const avgLatency = logs && logs.length > 0
    ? Math.round(logs.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / logs.length)
    : 0;
  const blockRatio = sent > 0 ? Math.round((blocked / sent) * 10000) / 100 : 0;

  // Get recent events
  const { data: events } = await supabase
    .from("wa_motor_events")
    .select("id, event_type, phone, reason, created_at")
    .gte("created_at", since24h)
    .order("created_at", { ascending: false })
    .limit(10);

  // Build alerts
  const alerts: Array<{ level: "warning" | "critical"; message: string; timestamp: string }> = [];
  if (blockRatio > 5) alerts.push({
    level: "critical",
    message: `Tasa de bloqueos alta: ${blockRatio.toFixed(2)}%`,
    timestamp: new Date().toISOString(),
  });
  if (blocked > 3) alerts.push({
    level: "warning",
    message: `${blocked} contactos bloquearon en últimas 24h`,
    timestamp: new Date().toISOString(),
  });
  if (bounces > 5) alerts.push({
    level: "warning",
    message: `${bounces} números inválidos detectados`,
    timestamp: new Date().toISOString(),
  });
  if (avgLatency > 3000) alerts.push({
    level: "warning",
    message: `Latencia alta: ${avgLatency}ms`,
    timestamp: new Date().toISOString(),
  });

  const status: "connected" | "limited" | "blocked" =
    blockRatio > 5 ? "blocked" : blockRatio > 2 ? "limited" : "connected";

  return {
    status,
    last24h: {
      sent,
      blocked,
      bounces,
      failed: sent - blocked - bounces,
      avgLatency,
      blockRatio,
    },
    recentEvents: events?.map(e => ({
      id: e.id,
      type: e.event_type,
      phone: e.phone.slice(-4),
      reason: e.reason,
      createdAt: e.created_at,
    })) || [],
    alerts,
  };
}
