import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

const TIERS = [
  { key: "standard",  label: "Standard",  minGyms: 0,  pct: 20 },
  { key: "premium",   label: "Premium",   minGyms: 10, pct: 25 },
  { key: "franchise", label: "Franquicia",minGyms: 25, pct: 30 },
];

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, name, slug, commission_pct, tier, status, payout_info, cuit, fiscal_condition")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!reseller) return NextResponse.json({ error: "Not a reseller" }, { status: 403 });

  const nowIso      = new Date().toISOString();
  const thisMonth   = nowIso.slice(0, 7);
  const lastMonthDt = new Date(); lastMonthDt.setMonth(lastMonthDt.getMonth() - 1);
  const lastMonth   = lastMonthDt.toISOString().slice(0, 7);

  const [{ data: gyms }, { data: commissions }, { data: withdrawals }] = await Promise.all([
    sb
      .from("gyms")
      .select("id, gym_name, owner_name, is_subscription_active, gym_status, subscription_expires_at, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false }),
    sb
      .from("reseller_commissions")
      .select("id, gym_id, commission_amount, payment_type, period_month, status, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(120),
    sb
      .from("withdrawal_requests")
      .select("id, amount, status, requested_at, paid_at")
      .eq("reseller_id", reseller.id)
      .order("requested_at", { ascending: false })
      .limit(10),
  ]);

  const gymList   = gyms ?? [];
  const commList  = commissions ?? [];
  const withList  = withdrawals ?? [];

  const activeGyms  = gymList.filter(g => g.is_subscription_active).length;
  const thisMonthC  = commList.filter(c => c.period_month === thisMonth);
  const lastMonthC  = commList.filter(c => c.period_month === lastMonth);
  const thisMonthAmt= thisMonthC.reduce((s, c) => s + (c.commission_amount ?? 0), 0);
  const lastMonthAmt= lastMonthC.reduce((s, c) => s + (c.commission_amount ?? 0), 0);
  const pendingAmt  = commList.filter(c => c.status === "pending").reduce((s, c) => s + (c.commission_amount ?? 0), 0);
  const paidAmt     = commList.filter(c => c.status === "paid").reduce((s, c) => s + (c.commission_amount ?? 0), 0);

  // Next estimated commission: earliest active gym renewal
  const nextRenewal = gymList
    .filter(g => g.is_subscription_active && g.subscription_expires_at)
    .map(g => ({ name: g.gym_name, date: g.subscription_expires_at! }))
    .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;

  // Tier progress
  const currentTierIdx = [...TIERS].reverse().findIndex(t => activeGyms >= t.minGyms);
  const resolvedTierIdx = currentTierIdx >= 0 ? TIERS.length - 1 - currentTierIdx : 0;
  const currentTier  = TIERS[resolvedTierIdx];
  const nextTier     = TIERS[resolvedTierIdx + 1] ?? null;
  const gymsToNext   = nextTier ? nextTier.minGyms - activeGyms : 0;
  const tierProgress = nextTier
    ? Math.round(((activeGyms - currentTier.minGyms) / (nextTier.minGyms - currentTier.minGyms)) * 100)
    : 100;

  // Annual projection at current rate
  const annualProjection = Math.round(activeGyms * 65000 * (reseller.commission_pct / 100) * 12);

  // Pending withdrawal already requested?
  const hasPendingWithdrawal = withList.some(w => w.status === "pending" || w.status === "processing");

  return NextResponse.json({
    reseller,
    gyms: gymList,
    commissions: commList,
    withdrawals: withList,
    stats: {
      totalGyms:           gymList.length,
      activeGyms,
      thisMonthAmt,
      lastMonthAmt,
      pctChange:           lastMonthAmt > 0 ? Math.round(((thisMonthAmt - lastMonthAmt) / lastMonthAmt) * 100) : null,
      pendingAmt,
      paidAmt,
      annualProjection,
      nextRenewal,
    },
    tier: {
      current:     currentTier,
      next:        nextTier,
      gymsToNext,
      progress:    tierProgress,
    },
    hasPendingWithdrawal,
    minWithdrawal: 50000,
  });
}
