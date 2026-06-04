import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const sb = getSupabaseAdminClient();
const PAGE_SIZE = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const gym_id  = searchParams.get("gym_id") ?? "";
  const action  = searchParams.get("action") ?? "";
  const from    = searchParams.get("from") ?? "";
  const to      = searchParams.get("to") ?? "";
  const page    = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const offset  = (page - 1) * PAGE_SIZE;

  let query = sb
    .from("platform_audit_logs")
    .select(
      "id, actor_id, action, resource_type, resource_id, before_state, after_state, meta, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (action) {
    query = query.eq("action", action);
  }
  if (from) {
    query = query.gte("created_at", from);
  }
  if (to) {
    query = query.lte("created_at", to);
  }
  if (gym_id && UUID_RE.test(gym_id)) {
    // resource_id matches (for impersonate_*) OR gym_id lives in after_state/before_state JSON
    query = query.or(
      `resource_id.eq.${gym_id},after_state->>gym_id.eq.${gym_id},before_state->>gym_id.eq.${gym_id}`,
    );
  }

  const { data, error, count } = await query;
if (error) {
  void logger.error("db error", { route: "/platform/audit-logs", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  // Fetch distinct actions for the filter dropdown (cheap — small cardinality)
  const { data: actionRows } = await sb
    .from("platform_audit_logs")
    .select("action")
    .order("action");

  const distinctActions = [
    ...new Set((actionRows ?? []).map((r: { action: string }) => r.action)),
  ];

  const total = count ?? 0;

  return NextResponse.json({
    ok: true,
    logs: data ?? [],
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    actions: distinctActions,
  });
}
