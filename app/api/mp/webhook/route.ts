import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { addOneMonth } from "@/lib/date-utils";

const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN!;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  if (!MP_WEBHOOK_SECRET) {
    console.error("MP_WEBHOOK_SECRET no configurado");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const xSignature  = req.headers.get("x-signature") ?? "";
  const xRequestId  = req.headers.get("x-request-id") ?? "";
  const dataId      = new URL(req.url).searchParams.get("data.id") ?? "";
  const ts          = xSignature.split(";").find(p => p.startsWith("ts="))?.split("=")[1] ?? "";
  const template    = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
  const expected    = createHmac("sha256", MP_WEBHOOK_SECRET).update(template).digest("hex");
  const received    = xSignature.split(";").find(p => p.startsWith("v1="))?.split("=")[1] ?? "";
  if (received !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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

  const { error: dbErr } = await supabaseAdmin
    .from("gyms")
    .update({
      mp_preapproval_id: id,
      is_subscription_active: isActive,
      ...(isActive    ? { subscription_expires_at: addOneMonth(new Date()).toISOString() } : {}),
      ...(isCancelled ? { is_subscription_active: false, subscription_expires_at: null } : {}),
    })
    .eq("id", gymId);

  if (dbErr) console.error(`MP webhook: DB update failed para gym ${gymId}:`, dbErr.message);
  console.log(`MP webhook: gym ${gymId} → preapproval ${id} → ${status}`);

  // Notify gym owner via WA when subscription is cancelled or payment fails
  if (isCancelled) {
    const motorUrl = process.env.WA_MOTOR_URL;
    if (motorUrl) {
      const { data: settings } = await supabaseAdmin
        .from("gym_settings")
        .select("gym_name, whatsapp")
        .eq("gym_id", gymId)
        .maybeSingle();

      const phone = settings?.whatsapp;
      const gymName = settings?.gym_name ?? "tu gimnasio";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "fitgrowx.app";

      if (phone) {
        const message = `⚠️ *${gymName}* — Hubo un problema con el pago de tu suscripción FitGrowX y tu acceso fue suspendido.\n\nPodés renovarla en: ${appUrl}/dashboard/suscripcion\n\nSi tenés dudas, escribinos a soporte@fitgrowx.com.`;
        try {
          await fetch(`${motorUrl}/send/${gymId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
            body: JSON.stringify({ phone, message }),
            signal: AbortSignal.timeout(8000),
          });
        } catch (err) {
          console.error(`MP webhook: WA notif failed para gym ${gymId}:`, err instanceof Error ? err.message : err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

// MP también hace GET para verificar el endpoint
export async function GET() {
  return NextResponse.json({ ok: true });
}
