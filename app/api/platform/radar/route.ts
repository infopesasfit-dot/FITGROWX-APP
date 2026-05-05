import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verificar que el caller sea platform_owner
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabaseAdminClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "platform_owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const h1ago = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [recentLogs, errorsH1, errorsH24, totalH24, errorRows] = await Promise.all([
    sb
      .from("platform_logs")
      .select("id, level, route, message, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    sb.from("platform_logs").select("*", { count: "exact", head: true }).eq("level", "ERROR").gte("created_at", h1ago),
    sb.from("platform_logs").select("*", { count: "exact", head: true }).eq("level", "ERROR").gte("created_at", h24ago),
    sb.from("platform_logs").select("*", { count: "exact", head: true }).gte("created_at", h24ago),
    sb.from("platform_logs").select("route").eq("level", "ERROR").gte("created_at", h24ago).not("route", "is", null),
  ]);

  const routeCounts: Record<string, number> = {};
  for (const row of errorRows.data ?? []) {
    if (row.route) routeCounts[row.route] = (routeCounts[row.route] ?? 0) + 1;
  }
  const topErrorRoutes = Object.entries(routeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([route, count]) => ({ route, count }));

  const total = totalH24.count ?? 0;
  const err24 = errorsH24.count ?? 0;

  return NextResponse.json({
    errors_last_1h: errorsH1.count ?? 0,
    errors_last_24h: err24,
    total_last_24h: total,
    error_rate_24h_pct: total > 0 ? parseFloat(((err24 / total) * 100).toFixed(1)) : 0,
    alert_threshold_pct: 1,
    top_error_routes: topErrorRoutes,
    logs: recentLogs.data ?? [],
  });
}
