import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendWa } from "@/lib/wa";
import { logger } from "@/lib/logger";
import { sanitizeAuditState } from "@/lib/platform-audit";

const sb = getSupabaseAdminClient();
const VALID_RESELLER_TIERS = new Set(["standard", "premium", "franchise"]);

async function assertPlatformOwner() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "platform_owner" ? user : null;
}

async function writeResellerAuditLog(entry: {
  actor_id: string | null;
  entity_type: "reseller" | "application";
  entity_id: string;
  action: "approve" | "reject" | "update" | "soft_delete" | "category_change" | "create";
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  notes?: string;
}) {
  try {
    const { error } = await sb.from("reseller_audit_log").insert({
      ...entry,
      before: entry.before ? (sanitizeAuditState(entry.before) as Record<string, unknown>) : entry.before,
      after:  entry.after  ? (sanitizeAuditState(entry.after)  as Record<string, unknown>) : entry.after,
    });
    if (error) console.error("Reseller audit log failed:", error.message);
  } catch (error) {
    console.error("Reseller audit log failed:", error);
  }
}

function parseCommissionPct(value: unknown, fallback?: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function invalidTierResponse() {
  return NextResponse.json({ error: "Tier inválido" }, { status: 400 });
}

function invalidCommissionResponse() {
  return NextResponse.json({ error: "commission_pct debe estar entre 0 y 100" }, { status: 400 });
}

// GET — list all resellers with stats
export async function GET(req: NextRequest) {
  if (!await assertPlatformOwner()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const includeDeleted = new URL(req.url).searchParams.get("include_deleted") === "true";
  let query = sb
    .from("resellers")
    .select("id, name, slug, commission_pct, tier, status, payout_info, cuit, fiscal_condition, user_id, created_at")
    .order("created_at", { ascending: false });
  if (!includeDeleted) query = query.neq("status", "deleted");

  const { data: resellers } = await query;

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
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, slug, commission_pct, tier, payout_info, email } = await req.json();

  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "Nombre y slug requeridos" }, { status: 400 });
  }

  // Check slug unique
  const { data: existing } = await sb.from("resellers").select("id").eq("slug", slug.trim()).maybeSingle();
  if (existing) return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });

  const resellerTier = tier || "standard";
  if (!VALID_RESELLER_TIERS.has(resellerTier)) return invalidTierResponse();

  const resellerCommissionPct = parseCommissionPct(commission_pct, 20);
  if (resellerCommissionPct === undefined || !Number.isFinite(resellerCommissionPct) || resellerCommissionPct < 0 || resellerCommissionPct > 100) {
    return invalidCommissionResponse();
  }

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
    commission_pct: resellerCommissionPct,
    tier:           resellerTier,
    payout_info:    payout_info?.trim() || null,
    status:         "active",
    user_id:        userId,
  }).select().single();

if (error) {
  void logger.error("db error", { route: "/platform/resellers", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }
  await writeResellerAuditLog({
    actor_id: actor.id,
    entity_type: "reseller",
    entity_id: reseller.id,
    action: "create",
    before: null,
    after: {
      id: reseller.id,
      name: reseller.name,
      slug: reseller.slug,
      commission_pct: reseller.commission_pct,
      tier: reseller.tier,
      status: reseller.status,
      user_id: reseller.user_id,
    },
  });
  return NextResponse.json({ reseller });
}

// PATCH — update reseller (commission, tier, status) or mark withdrawal paid
export async function PATCH(req: NextRequest) {
  const actor = await assertPlatformOwner();
  if (!actor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  // Mark withdrawal paid
  if (body.type === "pay_withdrawal") {
    const { data: paidWithdrawal, error: payErr } = await sb
      .rpc("pay_reseller_withdrawal", { p_withdrawal_id: body.withdrawalId })
      .single();
    if (payErr) {
      void logger.error("db error paying withdrawal", { route: "/api/platform/resellers", meta: { payErr } });
      return NextResponse.json({ error: "No se pudo marcar el retiro como pagado." }, { status: 500 });
    }

    const paid = paidWithdrawal as { reseller_id?: string; amount?: number | string } | null;
    const wr = paid
      ? {
          reseller_id: paid.reseller_id as string,
          amount: Number(paid.amount ?? 0),
        }
      : null;
    if (wr?.reseller_id) {
      // Notify reseller via WA
      {
        const { data: reseller } = await sb.from("resellers").select("user_id, payout_info").eq("id", wr.reseller_id).maybeSingle();
        if (reseller?.user_id) {
          const { data: profile } = await sb.from("profiles").select("gym_id").eq("id", reseller.user_id).maybeSingle();
          if (profile?.gym_id) {
            const { data: gymSettings } = await sb.from("gym_settings").select("whatsapp").eq("gym_id", profile.gym_id).maybeSingle();
            if (gymSettings?.whatsapp) {
              void sendWa(
                "fitgrowx-platform",
                gymSettings.whatsapp,
                `💸 *¡Tu retiro fue procesado!*\n\nMonto: $${wr.amount.toLocaleString("es-AR")} ARS\nDestino: ${reseller.payout_info ?? "tu cuenta"}\n\nGracias por ser parte de la red FitGrowX 🙌`,
                { route: "resellers/withdrawal" },
              );
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Update reseller fields
  const { resellerId, ...updates } = body;
  if (!resellerId) return NextResponse.json({ error: "resellerId requerido" }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  if (updates.commission_pct !== undefined) {
    const commissionPct = parseCommissionPct(updates.commission_pct);
    if (commissionPct === undefined || !Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) return invalidCommissionResponse();
    allowed.commission_pct = commissionPct;
  }
  if (updates.tier !== undefined) {
    if (!VALID_RESELLER_TIERS.has(updates.tier)) return invalidTierResponse();
    allowed.tier = updates.tier;
  }
  if (updates.status !== undefined)         allowed.status         = updates.status;
  if (updates.payout_info !== undefined)    allowed.payout_info    = updates.payout_info;

  const { data: before } = await sb
    .from("resellers")
    .select("id, commission_pct, tier, status, payout_info")
    .eq("id", resellerId)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Reseller no encontrado" }, { status: 404 });

  const { data: after, error } = await sb
    .from("resellers")
    .update(allowed)
    .eq("id", resellerId)
    .select("id, commission_pct, tier, status, payout_info")
    .single();
if (error) {
  void logger.error("db error", { route: "/platform/resellers", meta: { error } });
  return NextResponse.json({ error: "Error interno. Intente nuevamente." }, { status: 500 });
  }

  await writeResellerAuditLog({
    actor_id: actor.id,
    entity_type: "reseller",
    entity_id: resellerId,
    action: updates.tier !== undefined || updates.commission_pct !== undefined ? "category_change" : "update",
    before,
    after,
  });
  return NextResponse.json({ ok: true });
}
