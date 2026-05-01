import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendMonthlyDashboardReport } from "@/lib/monthly-dashboard-report-delivery";

type GymTarget = {
  gym_id: string;
  gym_name: string | null;
  email: string | null;
};

function isAuthorized(req: NextRequest) {
  const headerAuth = req.headers.get("authorization");
  const bearer = headerAuth?.startsWith("Bearer ") ? headerAuth.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET ?? process.env.FITGROWX_ADMIN_SECRET;
  return Boolean(expected && (bearer === expected || querySecret === expected));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const explicitMonth = req.nextUrl.searchParams.get("month");
  const reportMonthDate = explicitMonth
    ? new Date(`${explicitMonth}-01T12:00:00`)
    : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  if (Number.isNaN(reportMonthDate.getTime())) {
    return NextResponse.json({ error: "Formato de month inválido. Usá YYYY-MM." }, { status: 400 });
  }

  const reportMonth = reportMonthDate.toISOString().slice(0, 10);

  const { data: gyms, error: gymsError } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, email")
    .not("email", "is", null);

  if (gymsError) {
    return NextResponse.json({ error: gymsError.message }, { status: 500 });
  }

  const targets = (gyms ?? []) as GymTarget[];
  const results: Array<{ gym_id: string; status: string; detail?: string }> = [];

  for (const gym of targets) {
    if (!gym.email) {
      results.push({ gym_id: gym.gym_id, status: "skipped", detail: "Sin email configurado" });
      continue;
    }

    try {
      const sent = await sendMonthlyDashboardReport({
        gymId: gym.gym_id,
        email: gym.email,
        reportMonthDate,
      });
      results.push({ gym_id: gym.gym_id, status: sent.alreadySent ? "skipped" : "sent", detail: sent.alreadySent ? "Reporte ya enviado" : undefined });
    } catch (error) {
      results.push({
        gym_id: gym.gym_id,
        status: "error",
        detail: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  }

  const sent = results.filter((item) => item.status === "sent").length;
  return NextResponse.json({ ok: true, report_month: reportMonth, sent, total: targets.length, results });
}
