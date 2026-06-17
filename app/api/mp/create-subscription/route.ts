import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";
import { fetchMpWithTimeout } from "@/lib/mp/timeout";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN === "TU_ACCESS_TOKEN_MP_AQUI") {
    console.error("[MP] MP_ACCESS_TOKEN no está configurado");
    return NextResponse.json({ error: "Servicio de pagos no disponible." }, { status: 500 });
  }

  // Security: Only accept gym_id, plan_key, and billing. Price and description are resolved server-side from FITGROWX_PLANS
  const reqBody = await req.json();
  const gym_id = reqBody.gym_id;
  const plan_key = reqBody.plan_key;
  const billing = reqBody.billing;

  if (!gym_id || !plan_key || !billing || (billing !== "anual" && billing !== "mensual")) {
    return NextResponse.json({ error: "Faltan parámetros." }, { status: 400 });
  }

  const plan = FITGROWX_PLANS.find((p) => p.key === plan_key);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido." }, { status: 400 });
  }

  const amount = billing === "anual" ? plan.annualTotal : plan.priceMonthly;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  if (profile?.gym_id !== gym_id) return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });

  const body = {
    reason: `FitGrowX — ${plan.name}`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: amount,
      currency_id: "ARS",
    },
    back_url: `${APP_URL}/dashboard/suscripcion?mp=success`,
    external_reference: `${gym_id}|${plan_key}`,
    // El status arranca pending hasta que el user confirma el pago
    status: "pending",
  };

  const result = await fetchMpWithTimeout("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
    retryable: false,
  });

  if (!result.ok) {
    console.error("[MP] preapproval failed", {
      status: result.status,
      body: result.error, // raw MP response body (text)
    });
    return NextResponse.json({ error: "Servicio de pagos no disponible." }, { status: result.status || 500 });
  }

  const data = result.data as any;

  // Solo guardamos el preapproval_id — plan_type se setea en el webhook
  // cuando MP confirma el pago, no antes (evita dar Pro gratis si abandona el checkout)
  const { error: dbErr } = await supabaseAdmin
    .from("gyms")
    .update({ mp_preapproval_id: data.id })
    .eq("id", gym_id);
  if (dbErr) console.error("create-subscription: DB update failed:", dbErr.message);

  return NextResponse.json({ init_point: data.init_point, preapproval_id: data.id });
}
