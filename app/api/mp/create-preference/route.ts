import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { FITGROWX_PLANS } from "@/lib/fitgrowx-plans";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN === "TU_ACCESS_TOKEN_MP_AQUI") {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .maybeSingle();

  const gymId = profile?.gym_id;
  if (!gymId) return NextResponse.json({ error: "Gym no encontrado" }, { status: 404 });

  const { plan_key, billing } = await req.json();

  const plan = FITGROWX_PLANS.find((p) => p.key === plan_key);
  if (!plan) {
    return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
  }

  const amount = billing === "anual" ? plan.annualTotal : plan.priceMonthly;

  const body = {
    items: [
      {
        id: plan_key,
        title: `FitGrowX — ${plan.name}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
        description: billing === "anual" ? "Plan Anual FitGrowX · 12 meses de acceso · 2 meses gratis" : "Plan Mensual FitGrowX",
      },
    ],
    back_urls: {
      success: `${APP_URL}/dashboard/planes?mp=success`,
      failure: `${APP_URL}/dashboard/planes?mp=failure`,
      pending: `${APP_URL}/dashboard/planes?mp=pending`,
    },
    auto_return: "approved",
    statement_descriptor: "FITGROWX",
    external_reference: `${gymId}|${plan_key}|annual`,
  };

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: data.message ?? "Error MP" }, { status: res.status });
  }

  return NextResponse.json({ init_point: data.init_point });
}
