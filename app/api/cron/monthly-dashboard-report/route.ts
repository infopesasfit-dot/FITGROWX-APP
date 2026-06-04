import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendMonthlyDashboardReport } from "@/lib/monthly-dashboard-report-delivery";
import { isCronAuthorized } from "@/lib/request-security";

type GymTarget = {
  gym_id: string;
  gym_name: string | null;
  email: string | null;
};
type GymBillingRow = {
  id: string;
  is_subscription_active: boolean | null;
  trial_expires_at: string | null;
  gym_status: string | null;
};

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
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
    void supabase.from("cron_runs").insert({ cron_name: "monthly-dashboard-report", status: "error", duration_ms: Date.now() - startedAt, summary: gymsError.message });
    return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  const rawTargets = (gyms ?? []) as GymTarget[];
  const gymIds = rawTargets.map((gym) => gym.gym_id);
  const { data: billingRows } = await supabase
    .from("gyms")
    .select("id, is_subscription_active, trial_expires_at, gym_status")
    .in("id", gymIds);

  const todayIso = new Date().toISOString();
  const billingMap = new Map(
    ((billingRows ?? []) as GymBillingRow[]).map((row) => [
      row.id,
      row.is_subscription_active === true ||
      (!!row.trial_expires_at && row.trial_expires_at >= todayIso && row.gym_status !== "cancelled"),
    ]),
  );

  const targets = rawTargets.filter((gym) => billingMap.get(gym.gym_id) === true);
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
  const skipped = results.filter((item) => item.status === "skipped").length;
  const errors = results.filter((item) => item.status === "error").length;
  void supabase.from("cron_runs").insert({ cron_name: "monthly-dashboard-report", status: "ok", duration_ms: Date.now() - startedAt, summary: `Mes ${reportMonth} · ${sent}/${targets.length} enviados`, counts: { sent, skipped, errors, total: targets.length, results } });
  return NextResponse.json({ ok: true, report_month: reportMonth, sent, total: targets.length, results });
}
