import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logPlatformAudit } from "@/lib/platform-audit";
import { assertPlatformOwner } from "@/lib/auth-platform";

export async function POST(req: NextRequest) {
  const user = await assertPlatformOwner();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { cron, gym_id } = await req.json() as { cron: string; gym_id?: string };

  const waSecret  = process.env.WA_MOTOR_API_KEY ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let res: Response;

  const waHeader  = { Authorization: `Bearer ${waSecret}` };
  const cronHeader = { Authorization: `Bearer ${cronSecret}` };

  switch (cron) {
    case "vencimientos":
      res = await fetch(`${appUrl}/api/cron/vencimientos`, { headers: cronHeader });
      break;
    case "ausentes":
      res = await fetch(`${appUrl}/api/cron/ausentes`, { headers: cronHeader });
      break;
    case "trial-check":
      res = await fetch(`${appUrl}/api/cron/trial-check`, { headers: cronHeader });
      break;
    case "monthly-report":
      res = await fetch(`${appUrl}/api/cron/monthly-dashboard-report`, { headers: cronHeader });
      break;
    case "wa-keepalive":
      res = await fetch(`${appUrl}/api/cron/wa-keepalive`, { headers: cronHeader });
      break;
    case "clase-gratis-followup":
      res = await fetch(`${appUrl}/api/cron/clase-gratis-followup`, { headers: cronHeader });
      break;
    case "ausentes-trigger":
      if (!gym_id) return NextResponse.json({ error: "gym_id requerido para este cron." }, { status: 400 });
      res = await fetch(`${appUrl}/api/cron/ausentes-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cronHeader },
        body: JSON.stringify({ gym_id }),
      });
      break;
    default:
      return NextResponse.json({ error: "Cron desconocido." }, { status: 400 });
  }

  const result = await res.json().catch(() => ({ raw: "no json" }));

  const sb = getSupabaseAdminClient();
  logPlatformAudit(sb, {
    actor_id: user.id,
    action: "cron_trigger",
    resource_type: "cron",
    resource_id: cron,
    meta: { gym_id: gym_id ?? null, http_status: res.status, ok: res.ok },
  });

  return NextResponse.json({ ok: true, status: res.status, result });
}
