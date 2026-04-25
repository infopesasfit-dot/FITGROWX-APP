import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { gym_id, plan_key, plan_label, price_ars } = await req.json();

  if (!gym_id || !plan_key || !price_ars) {
    return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
  }

  // Obtener email del gym para precompletar el pago
  const { data: settings } = await supabaseAdmin
    .from("gym_settings")
    .select("email")
    .eq("gym_id", gym_id)
    .maybeSingle();

  const body = {
    reason: `FitGrowX — ${plan_label}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: Math.round(price_ars),
      currency_id: "ARS",
    },
    payer_email: settings?.email ?? undefined,
    back_url: `${APP_URL}/dashboard/suscripcion?mp=success`,
    external_reference: `${gym_id}|${plan_key}`,
    // El status arranca pending hasta que el user confirma el pago
    status: "pending",
  };

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("MP preapproval error:", data);
    return NextResponse.json({ error: data.message ?? "Error MP" }, { status: res.status });
  }

  // Guardar preapproval_id y plan en Supabase (pendiente hasta webhook confirme)
  await supabaseAdmin
    .from("gyms")
    .update({
      mp_preapproval_id: data.id,
      plan_type: plan_key,
    })
    .eq("id", gym_id);

  return NextResponse.json({ init_point: data.init_point, preapproval_id: data.id });
}
