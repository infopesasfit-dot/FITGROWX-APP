import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { MIN_WITHDRAWAL } from "@/lib/constants";

const sb = getSupabaseAdminClient();

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, name, payout_info")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!reseller) return NextResponse.json({ error: "Not a reseller" }, { status: 403 });

  // Check pending amount
  const { data: pending } = await sb
    .from("reseller_commissions")
    .select("commission_amount")
    .eq("reseller_id", reseller.id)
    .eq("status", "pending");

  const totalPending = (pending ?? []).reduce((s, c) => s + (c.commission_amount ?? 0), 0);
  if (totalPending < MIN_WITHDRAWAL) {
    return NextResponse.json({ error: `Monto mínimo para retiro: $${MIN_WITHDRAWAL.toLocaleString("es-AR")}` }, { status: 400 });
  }

  // Check no pending request already
  const { data: existing } = await sb
    .from("withdrawal_requests")
    .select("id")
    .eq("reseller_id", reseller.id)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "Ya tenés una solicitud pendiente" }, { status: 409 });

  await sb.from("withdrawal_requests").insert({
    reseller_id: reseller.id,
    amount:      totalPending,
    status:      "pending",
  });

  // Notify admin via WA
  const motorUrl   = process.env.WA_MOTOR_URL;
  const ownerPhone = process.env.OWNER_PHONE;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";

  if (motorUrl && ownerPhone) {
    const msg =
      `💸 *Solicitud de retiro — Reseller*\n\n` +
      `👤 ${reseller.name}\n` +
      `💰 Monto: $${totalPending.toLocaleString("es-AR")} ARS\n` +
      `🏦 Destino: ${reseller.payout_info ?? "sin CBU cargado"}\n\n` +
      `Ver en plataforma: ${appUrl}/platform`;
    fetch(`${motorUrl}/send/fitgrowx-platform`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
      body: JSON.stringify({ phone: ownerPhone, message: msg }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, amount: totalPending });
}
