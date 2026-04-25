import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN!;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  // Validar firma de MP si la clave está configurada
  if (MP_WEBHOOK_SECRET) {
    const xSignature  = req.headers.get("x-signature") ?? "";
    const xRequestId  = req.headers.get("x-request-id") ?? "";
    const dataId      = new URL(req.url).searchParams.get("data.id") ?? "";
    const signedStr   = `id:${dataId};request-id:${xRequestId};ts:${xSignature.split(";").find(p => p.startsWith("ts="))?.split("=")[1] ?? ""}`;
    const ts          = xSignature.split(";").find(p => p.startsWith("ts="))?.split("=")[1] ?? "";
    const template    = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
    const expected    = createHmac("sha256", MP_WEBHOOK_SECRET).update(template).digest("hex");
    const received    = xSignature.split(";").find(p => p.startsWith("v1="))?.split("=")[1] ?? "";
    if (received && received !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const { type, data } = body;

  // Solo nos interesan eventos de preapproval
  if (type !== "preapproval" || !data?.id) {
    return NextResponse.json({ ok: true });
  }

  // Consultar estado actual a la API de MP
  const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });

  if (!mpRes.ok) {
    console.error("MP webhook: no se pudo consultar preapproval", data.id);
    return NextResponse.json({ ok: true });
  }

  const preapproval = await mpRes.json();
  const { id, status, external_reference } = preapproval;

  // external_reference = "gym_id|plan_key"
  const gymId = external_reference?.split("|")[0];
  if (!gymId) return NextResponse.json({ ok: true });

  const isActive = status === "authorized";
  const isCancelled = status === "cancelled" || status === "paused";

  await supabaseAdmin
    .from("gyms")
    .update({
      mp_preapproval_id: id,
      is_subscription_active: isActive,
      ...(isCancelled ? { is_subscription_active: false } : {}),
    })
    .eq("id", gymId);

  console.log(`MP webhook: gym ${gymId} → preapproval ${id} → ${status}`);

  return NextResponse.json({ ok: true });
}

// MP también hace GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ ok: true });
}
