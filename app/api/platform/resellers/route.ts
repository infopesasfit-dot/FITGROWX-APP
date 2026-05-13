import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

// GET — list all resellers with stats
export async function GET() {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: resellers } = await sb
    .from("resellers")
    .select("id, name, slug, commission_pct, tier, status, payout_info, cuit, fiscal_condition, user_id, created_at")
    .order("created_at", { ascending: false });

  if (!resellers?.length) return NextResponse.json({ resellers: [] });

  // Enrich with gym counts and pending commissions
  const enriched = await Promise.all((resellers).map(async (r) => {
    const [{ count: totalGyms }, { count: activeGyms }, { data: pending }] = await Promise.all([
      sb.from("gyms").select("id", { count: "exact", head: true }).eq("reseller_id", r.id),
      sb.from("gyms").select("id", { count: "exact", head: true }).eq("reseller_id", r.id).eq("is_subscription_active", true),
      sb.from("reseller_commissions").select("commission_amount").eq("reseller_id", r.id).eq("status", "pending"),
    ]);
    const pendingAmt = (pending ?? []).reduce((s, c) => s + (c.commission_amount ?? 0), 0);
    return { ...r, totalGyms: totalGyms ?? 0, activeGyms: activeGyms ?? 0, pendingAmt };
  }));

  // Withdrawal requests pending
  const { data: withdrawals } = await sb
    .from("withdrawal_requests")
    .select("id, reseller_id, amount, status, requested_at, resellers(name)")
    .in("status", ["pending", "processing"])
    .order("requested_at", { ascending: true });

  return NextResponse.json({ resellers: enriched, pendingWithdrawals: withdrawals ?? [] });
}

// POST — create reseller
export async function POST(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, commission_pct, tier, payout_info, email } = await req.json();

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });
  }

  // Check slug unique
  const { data: existing } = await sb.from("resellers").select("id").eq("slug", slug.trim()).maybeSingle();
  if (existing) return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });

  // Resolve user_id from email if provided
  let userId: string | null = null;
  if (email?.trim()) {
    const { data: users } = await sb.auth.admin.listUsers();
    const match = users?.users?.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
    userId = match?.id ?? null;
  }

  const { data: reseller, error } = await sb.from("resellers").insert({
    name:           name.trim(),
    slug:           slug.trim().toLowerCase(),
    commission_pct: Number(commission_pct) || 20,
    tier:           tier || "standard",
    payout_info:    payout_info?.trim() || null,
    status:         "active",
    user_id:        userId,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reseller });
}

// PATCH — update reseller (commission, tier, status) or mark withdrawal paid
export async function PATCH(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Mark withdrawal paid
  if (body.type === "pay_withdrawal") {
    await sb.from("withdrawal_requests").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", body.withdrawalId);

    // Mark those commissions as paid
    const { data: wr } = await sb.from("withdrawal_requests").select("reseller_id, amount").eq("id", body.withdrawalId).maybeSingle();
    if (wr?.reseller_id) {
      // Mark all pending commissions up to the withdrawal amount as paid
      const { data: pendingComms } = await sb
        .from("reseller_commissions")
        .select("id, commission_amount")
        .eq("reseller_id", wr.reseller_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      let remaining = wr.amount;
      const toMark: string[] = [];
      for (const c of pendingComms ?? []) {
        if (remaining <= 0) break;
        toMark.push(c.id);
        remaining -= c.commission_amount ?? 0;
      }
      if (toMark.length) {
        await sb.from("reseller_commissions").update({ status: "paid" }).in("id", toMark);
      }

      // Notify reseller via WA
      const motorUrl = process.env.WA_MOTOR_URL;
      if (motorUrl) {
        const { data: reseller } = await sb.from("resellers").select("user_id, payout_info").eq("id", wr.reseller_id).maybeSingle();
        if (reseller?.user_id) {
          const { data: profile } = await sb.from("profiles").select("gym_id").eq("id", reseller.user_id).maybeSingle();
          if (profile?.gym_id) {
            const { data: gymSettings } = await sb.from("gym_settings").select("whatsapp").eq("gym_id", profile.gym_id).maybeSingle();
            if (gymSettings?.whatsapp) {
              fetch(`${motorUrl}/send/fitgrowx-platform`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
                body: JSON.stringify({
                  phone: gymSettings.whatsapp,
                  message: `💸 *¡Tu retiro fue procesado!*\n\nMonto: $${wr.amount.toLocaleString("es-AR")} ARS\nDestino: ${reseller.payout_info ?? "tu cuenta"}\n\nGracias por ser parte de la red FitGrowX 🙌`,
                }),
                signal: AbortSignal.timeout(8000),
              }).catch(() => {});
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Update reseller fields
  const { resellerId, ...updates } = body;
  const allowed: Record<string, unknown> = {};
  if (updates.commission_pct !== undefined) allowed.commission_pct = Number(updates.commission_pct);
  if (updates.tier !== undefined)           allowed.tier           = updates.tier;
  if (updates.status !== undefined)         allowed.status         = updates.status;
  if (updates.payout_info !== undefined)    allowed.payout_info    = updates.payout_info;

  await sb.from("resellers").update(allowed).eq("id", resellerId);
  return NextResponse.json({ ok: true });
}
