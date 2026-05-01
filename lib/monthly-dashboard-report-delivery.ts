import { Resend } from "resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { buildMonthlyDashboardReport, buildMonthlyReportEmail } from "@/lib/monthly-dashboard-report";

export async function sendMonthlyDashboardReport(options: {
  gymId: string;
  email: string;
  reportMonthDate?: Date;
}) {
  const { gymId, email, reportMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1) } = options;
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("RESEND_API_KEY no configurado.");
  }

  const supabase = getSupabaseAdminClient();
  const resend = new Resend(resendKey);
  const reportMonth = reportMonthDate.toISOString().slice(0, 10);

  const { data: alreadySent } = await supabase
    .from("monthly_dashboard_reports")
    .select("id")
    .eq("gym_id", gymId)
    .eq("report_month", reportMonth)
    .maybeSingle();

  if (alreadySent) {
    return { ok: true as const, alreadySent: true as const, reportMonth };
  }

  const report = await buildMonthlyDashboardReport(gymId, reportMonthDate);
  const { html, text } = buildMonthlyReportEmail(report);
  const { data, error } = await resend.emails.send({
    from: "FitGrowX <noreply@fitgrowx.com>",
    to: email,
    subject: `Tu reporte mensual de ${report.monthLabel} ya está listo`,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message ?? "Error enviando reporte con Resend.");
  }

  await supabase.from("monthly_dashboard_reports").insert([{
    gym_id: gymId,
    report_month: reportMonth,
    email,
    resend_id: data?.id ?? null,
  }]);

  await supabase.from("notifications").insert([{
    gym_id: gymId,
    type: "monthly_report",
    title: "Tu reporte mensual ya está listo",
    body: `Te enviamos el resumen de ${report.monthLabel} al email ${email}.`,
    link: "/dashboard",
    read: false,
  }]);

  return { ok: true as const, alreadySent: false as const, reportMonth, report };
}
