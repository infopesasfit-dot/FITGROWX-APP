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

  const { data: withdrawal, error: withdrawalErr } = await sb
    .rpc("create_reseller_withdrawal", {
      p_reseller_id: reseller.id,
      p_min_amount: MIN_WITHDRAWAL,
    })
    .single();
  if (withdrawalErr) {
    const msg = withdrawalErr.message ?? "";
    if (msg.includes("pending_withdrawal_exists")) {
      return NextResponse.json({ error: "Ya tenés una solicitud pendiente" }, { status: 409 });
    }
    if (msg.includes("minimum_withdrawal_not_met")) {
      return NextResponse.json({ error: `Monto mínimo para retiro: $${MIN_WITHDRAWAL.toLocaleString("es-AR")}` }, { status: 400 });
    }
    return NextResponse.json({ error: msg || "No se pudo solicitar el retiro" }, { status: 500 });
  }

  const createdWithdrawal = withdrawal as { withdrawal_request_id?: string; amount?: number | string } | null;
  const totalPending = Number(createdWithdrawal?.amount ?? 0);

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

  return NextResponse.json({ ok: true, amount: totalPending, withdrawalId: createdWithdrawal?.withdrawal_request_id });
}
