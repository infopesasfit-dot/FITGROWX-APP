import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const OWNER_EMAIL = "elianafrancoanahi@gmail.com";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== OWNER_EMAIL) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { cron, gym_id } = await req.json() as { cron: string; gym_id?: string };

  const waSecret  = process.env.WA_MOTOR_API_KEY ?? "";
  const cronSecret = process.env.CRON_SECRET ?? process.env.FITGROWX_ADMIN_SECRET ?? "";
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  let res: Response;

  const waHeader  = { Authorization: `Bearer ${waSecret}` };
  const cronHeader = { Authorization: `Bearer ${cronSecret}` };

  switch (cron) {
    case "vencimientos":
      res = await fetch(`${appUrl}/api/cron/vencimientos`, { headers: waHeader });
      break;
    case "ausentes":
      res = await fetch(`${appUrl}/api/cron/ausentes`, { headers: waHeader });
      break;
    case "trial-check":
      res = await fetch(`${appUrl}/api/cron/trial-check`, { headers: waHeader });
      break;
    case "monthly-report":
      res = await fetch(`${appUrl}/api/cron/monthly-dashboard-report`, { headers: cronHeader });
      break;
    case "wa-keepalive":
      res = await fetch(`${appUrl}/api/cron/wa-keepalive`, { headers: waHeader });
      break;
    case "clase-gratis-followup":
      res = await fetch(`${appUrl}/api/cron/clase-gratis-followup`, { headers: waHeader });
      break;
    case "ausentes-trigger":
      if (!gym_id) return NextResponse.json({ error: "gym_id requerido para este cron." }, { status: 400 });
      res = await fetch(`${appUrl}/api/cron/ausentes-trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...waHeader },
        body: JSON.stringify({ gym_id }),
      });
      break;
    default:
      return NextResponse.json({ error: "Cron desconocido." }, { status: 400 });
  }

  const result = await res.json().catch(() => ({ raw: "no json" }));
  return NextResponse.json({ ok: true, status: res.status, result });
}
