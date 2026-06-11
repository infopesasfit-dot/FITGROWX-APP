import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";

const PLAN_PRICE: Record<string, number> = Object.fromEntries(
  FITGROWX_PLANS.map(p => [p.key, p.priceMonthly])
);

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sb = getSupabaseAdminClient();

  const now       = new Date();
  const h1ago     = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const d7ago     = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d2ago     = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monthStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr  = now.toISOString().slice(0, 10);
  // Primer día del mes anterior
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    errorsH1,
    waDisconnected,
    mrrRows,
    gymsActivos,
    convertidosMes,
    trialsRisk,
    inactivos,
    prospectosSinSeg,
    feedbackReciente,
    convertedPrevMonth,
    churnedThisMonth,
    trialsCohort,
  ] = await Promise.all([
    sb.from("platform_logs")
      .select("id", { count: "exact", head: true })
      .eq("level", "ERROR")
      .gte("created_at", h1ago),

    sb.from("gym_settings")
      .select("gym_id", { count: "exact", head: true })
      .not("wa_status", "in", '("active","qr")'),

    sb.from("platform_accounts")
      .select("monthly_value, subscription_plan")
      .eq("status", "converted"),

    sb.from("gyms")
      .select("id", { count: "exact", head: true })
      .in("gym_status", ["trial", "active"]),

    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "converted")
      .gte("converted_at", monthStr),

    sb.from("platform_accounts")
      .select("id, company_name, trial_ends_at", { count: "exact" })
      .in("status", ["trial_active", "trial_risk"])
      .lte("trial_ends_at", new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
      .gte("trial_ends_at", todayStr)
      .order("trial_ends_at")
      .limit(5),

    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .in("status", ["trial_active", "trial_risk", "converted"])
      .not("last_seen_at", "is", null)
      .lt("last_seen_at", d7ago),

    sb.from("prospectos")
      .select("id", { count: "exact", head: true })
      .not("next_follow_up_at", "is", null)
      .lt("next_follow_up_at", d2ago)
      .neq("status", "convertido"),

    sb.from("platform_feedback")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // Gyms que eran 'converted' el mes anterior (para calcular churn base)
    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "converted")
      .gte("converted_at", prevMonthStr)
      .lt("converted_at", monthStr),

    // Gyms que pasaron a churned/cancelled este mes
    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .in("status", ["churned", "cancelled"])
      .gte("updated_at", monthStr),

    // Trials iniciados el mismo mes de cohorte del mes actual para tasa conversión
    sb.from("platform_accounts")
      .select("id", { count: "exact", head: true })
      .gte("trial_starts_at", prevMonthStr)
      .lt("trial_starts_at", monthStr),
  ]);

  const mrr = (mrrRows.data ?? []).reduce((s, r) => {
    const val = r.monthly_value ?? PLAN_PRICE[r.subscription_plan ?? ""] ?? 0;
    return s + Number(val);
  }, 0);

  const churnCount    = churnedThisMonth.count ?? 0;
  const churnBase     = convertedPrevMonth.count ?? 0;
  const churnRatePct  = churnBase > 0 ? parseFloat(((churnCount / churnBase) * 100).toFixed(1)) : 0;

  const cohortTrials  = trialsCohort.count ?? 0;
  const trialToPaid   = convertidosMes.count ?? 0;
  const trialToPaidRate = cohortTrials > 0 ? parseFloat(((trialToPaid / cohortTrials) * 100).toFixed(1)) : 0;

  return NextResponse.json({
    sistema: {
      erroresH1:       errorsH1.count ?? 0,
      waDesconectados: waDisconnected.count ?? 0,
    },
    negocio: {
      mrrMes:          mrr,
      gymsActivos:     gymsActivos.count ?? 0,
      conversionesMes: trialToPaid,
      churnCount,
      churnRatePct,
      trialToPaidRate,
    },
    atencion: {
      trialsRisk:         trialsRisk.count ?? 0,
      trialsRiskList:     trialsRisk.data ?? [],
      inactivos7d:        inactivos.count ?? 0,
      prospectosSinSeg:   prospectosSinSeg.count ?? 0,
      feedbackReciente7d: feedbackReciente.count ?? 0,
    },
  });
}
