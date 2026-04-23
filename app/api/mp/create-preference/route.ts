import { NextRequest, NextResponse } from "next/server";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const { plan_key, plan_label, price_ars } = await req.json();

  if (!MP_ACCESS_TOKEN || MP_ACCESS_TOKEN === "TU_ACCESS_TOKEN_MP_AQUI") {
    return NextResponse.json({ error: "MP_ACCESS_TOKEN no configurado" }, { status: 500 });
  }

  const body = {
    items: [
      {
        id: plan_key,
        title: `FitGrowX — ${plan_label}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: Math.round(price_ars),
      },
    ],
    back_urls: {
      success: `${APP_URL}/dashboard/planes?mp=success`,
      failure: `${APP_URL}/dashboard/planes?mp=failure`,
      pending: `${APP_URL}/dashboard/planes?mp=pending`,
    },
    auto_return: "approved",
    statement_descriptor: "FITGROWX",
    external_reference: plan_key,
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
