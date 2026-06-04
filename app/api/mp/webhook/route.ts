import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { addOneMonth } from "@/lib/date-utils";
import { sendWa } from "@/lib/wa";
import { fetchMpWithTimeout } from "@/lib/mp/timeout";
import { logger } from "@/lib/logger";
import { withApiHandler } from "@/lib/api-error";

const MP_ACCESS_TOKEN   = process.env.MP_ACCESS_TOKEN!;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function periodMonthFrom(value: string | null | undefined) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}

// Returns the list of self-referral signals matched (empty = none).
// Same user_id is a definitive self-referral; email/phone matches are strong
// heuristics for the case where the reseller signed up the gym under a second
// account. Callers must NOT pay a commission when this returns any match.
export async function detectSelfReferral(
  gym: { user_id?: string | null; email?: string | null; whatsapp?: string | null },
  reseller: { id: string; user_id?: string | null; name?: string | null; cuit?: string | null },
): Promise<string[]> {
  if (!gym.user_id || !reseller.user_id) return [];
  if (gym.user_id === reseller.user_id) return ["same_user"];

  const matches: string[] = [];
  let resellerEmail = "";
  let resellerPhone = "";

  const { data: resellerAuth } = await supabaseAdmin.auth.admin.getUserById(reseller.user_id);
  resellerEmail = normalizeEmail(resellerAuth?.user?.email);

  if (resellerEmail) {
    const { data: applicationByEmail } = await supabaseAdmin
      .from("reseller_applications")
      .select("email, whatsapp")
      .eq("email", resellerEmail)
      .maybeSingle();
    resellerPhone = normalizePhone(applicationByEmail?.whatsapp);
  }

  if (!resellerPhone && reseller.name) {
    const { data: applicationByName } = await supabaseAdmin
      .from("reseller_applications")
      .select("email, whatsapp")
      .eq("name", reseller.name)
      .eq("status", "approved")
      .maybeSingle();
    resellerEmail = resellerEmail || normalizeEmail(applicationByName?.email);
    resellerPhone = normalizePhone(applicationByName?.whatsapp);
  }

  if (normalizeEmail(gym.email) && normalizeEmail(gym.email) === resellerEmail) matches.push("email");
  if (normalizePhone(gym.whatsapp) && normalizePhone(gym.whatsapp) === resellerPhone) matches.push("phone");

  return matches;
}

function logWebhookPlatform(
  gymId: string | null,
  paymentId: string | null,
  eventType: string,
  status: "received" | "processed" | "duplicate" | "error" | "ignored",
  errorMsg?: string,
) {
  void supabaseAdmin.from("mp_webhook_log").insert({
    source:     "platform",
    gym_id:     gymId,
    payment_id: paymentId,
    event_type: eventType,
    status,
    error_msg:  errorMsg ?? null,
  });
}

async function createResellerCommission(
  gymId: string,
  paymentAmount: number,
  paymentRef: string,
  paymentType: "monthly" | "annual",
  periodMonth: string = periodMonthFrom(null),
) {
  const { data: gym } = await supabaseAdmin
    .from("gyms")
    .select("reseller_id, user_id, self_referral, email, whatsapp")
    .eq("id", gymId)
    .maybeSingle();
  if (!gym?.reseller_id) return;

  if (gym.self_referral) {
    console.log(`Reseller commission: self-referral, skipped commission for gym ${gymId}`);
    return;
  }

  const { data: reseller } = await supabaseAdmin
    .from("resellers")
    .select("id, user_id, name, commission_pct, status, slug, cuit")
    .eq("id", gym.reseller_id)
    .maybeSingle();
  if (!reseller || reseller.status !== "active") return;

  // Self-referral guard: never auto-pay a commission when the gym and the
  // reseller look like the same person. Skip the commission (like the
  // self_referral flag) and alert the platform owner to review manually.
  const selfReferralMatches = await detectSelfReferral(gym, reseller);
  if (selfReferralMatches.length > 0) {
    const wouldBe = Math.round(paymentAmount * (reseller.commission_pct / 100));
    void logger.warn("Reseller commission BLOCKED: possible self-referral", {
      route: "/api/mp/webhook",
      meta: { gymId, resellerId: reseller.id, cuit: reseller.cuit ?? "n/a", matches: selfReferralMatches.join(", ") },
    });
    const ownerPhone = normalizePhone((process.env.OWNER_PHONE ?? process.env.ALERT_PHONE));
    if (ownerPhone) {
      const alertMsg =
        `⚠️ *Comisión de reseller bloqueada — posible self-referral*\n\n` +
        `Gym ID: ${gymId}\n` +
        `Reseller: ${reseller.name ?? reseller.id} (${reseller.id})\n` +
        `Coincidencia: ${selfReferralMatches.join(", ")}\n` +
        `Monto que se habría pagado: $${wouldBe.toLocaleString("es-AR")}\n\n` +
        `No se creó comisión. Revisalo en /platform y, si es legítima, cargala manualmente.`;
      void sendWa("fitgrowx-platform", ownerPhone, alertMsg, { route: "mp/webhook" });
    }
    return;
  }

  const commissionAmount = Math.round(paymentAmount * (reseller.commission_pct / 100));

  const { data: insertedCommission, error: insertError } = await supabaseAdmin
    .from("reseller_commissions")
    .upsert({
      reseller_id:       reseller.id,
      gym_id:            gymId,
      mp_payment_ref:    paymentRef,
      payment_amount:    paymentAmount,
      commission_pct:    reseller.commission_pct,
      commission_amount: commissionAmount,
      payment_type:      paymentType,
      period_month:      periodMonth,
      status:            "pending",
    }, { onConflict: "mp_payment_ref", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (insertError) {
    void logger.error("Reseller commission insert failed", { route: "/api/mp/webhook", meta: { paymentRef, error: insertError.message } });
    return;
  }

  if (!insertedCommission) {
    console.log(`Reseller commission: duplicate payment ref ${paymentRef}, skipped commission`);
    return;
  }

  console.log(`Reseller commission: gym ${gymId} → reseller ${reseller.id} → $${commissionAmount} (${paymentType})`);
}

async function handlePost(req: NextRequest): Promise<NextResponse> {
  if (!MP_WEBHOOK_SECRET) {
    void logger.error("MP_WEBHOOK_SECRET no configurado", { route: "/api/mp/webhook" });
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const xSignature  = req.headers.get("x-signature") ?? "";
  const xRequestId  = req.headers.get("x-request-id") ?? "";
  const dataId      = new URL(req.url).searchParams.get("data.id") ?? "";
  const ts          = xSignature.split(";").find(p => p.startsWith("ts="))?.split("=")[1] ?? "";
  const template    = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
  const expected    = createHmac("sha256", MP_WEBHOOK_SECRET).update(template).digest("hex");
  const received    = xSignature.split(";").find(p => p.startsWith("v1="))?.split("=")[1] ?? "";
  const sigValid = received.length === expected.length &&
    timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
  if (!sigValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  const { type, data } = body;
  console.log("[mp-webhook]", JSON.stringify({
    type,
    action: body.action,
    dataId: (data as { id?: unknown })?.id ?? null,
    timestamp: new Date().toISOString(),
  }));

  // ── Pago único anual ──────────────────────────────────────────────────────
  if (type === "payment" && data?.id) {
    logWebhookPlatform(null, String(data.id), "payment", "received");
    const payResult = await fetchMpWithTimeout(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      retryable: true,
    });
    if (!payResult.ok) return NextResponse.json({ error: "mp_api_error" }, { status: 500 });

    const payment = payResult.data as any;
    const { id: paymentId, status: payStatus, external_reference: payRef } = payment;
    if (payStatus !== "approved") return NextResponse.json({ ok: true });

    const parts = (payRef ?? "").split("|");
    const gymId   = parts[0];
    const planKey = parts[1];
    const isAnnual = parts[2] === "annual";
    if (!gymId || !isAnnual) return NextResponse.json({ ok: true });

    // Idempotency: insert-first claim. Partial unique index on (payment_id, event_type)
    // WHERE status NOT IN ('received','error','ignored') makes concurrent duplicates race
    // on INSERT — only one wins, the rest get 23505 and return 200 without processing.
    const { data: claimRow, error: claimErr } = await supabaseAdmin
      .from("mp_webhook_log")
      .insert({
        source:     "platform",
        gym_id:     gymId,
        payment_id: String(paymentId),
        event_type: "payment",
        status:     "processing",
      })
      .select("id")
      .single();

    if (claimErr) {
      if (claimErr.code === "23505") return NextResponse.json({ ok: true });
      void logger.error("MP webhook: failed to claim annual payment", { route: "/api/mp/webhook", meta: { paymentId, error: claimErr.message } });
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    const { data: currentGym } = await supabaseAdmin
      .from("gyms")
      .select("mp_preapproval_id, subscription_expires_at, subscription_type")
      .eq("id", gymId)
      .maybeSingle();

    // Cancel monthly preapproval if present. Annual activates regardless of cancel outcome.
    // Success → clear mp_preapproval_id. Failure → preserve it for manual retry + alert owner.
    const monthlyPreapprovalId =
      currentGym?.subscription_type === "monthly" ? (currentGym.mp_preapproval_id ?? null) : null;
    let cancelledMonthly = false;

    if (monthlyPreapprovalId) {
      const cancelResult = await fetchMpWithTimeout(
        `https://api.mercadopago.com/preapproval/${monthlyPreapprovalId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
          body: JSON.stringify({ status: "cancelled" }),
          retryable: true,
        },
      );
      if (cancelResult.ok) {
        cancelledMonthly = true;
      } else {
        void logger.error("MP webhook: no se pudo cancelar preapproval mensual al activar anual", { route: "/api/mp/webhook", meta: { gymId, preapprovalId: monthlyPreapprovalId } });
        logWebhookPlatform(gymId, String(paymentId), "payment", "error", "monthly preapproval cancel failed on annual upgrade");
      }
    }

    const annualExpiry = new Date();
    annualExpiry.setFullYear(annualExpiry.getFullYear() + 1);

    // Annual plans expire by date (cron), not by preapproval — do NOT store paymentId here.
    // If monthly cancel succeeded → clear mp_preapproval_id.
    // If it failed → preserve the id so it can be retried; annual is still activated.
    await supabaseAdmin
      .from("gyms")
      .update({
        is_subscription_active: true,
        subscription_expires_at: annualExpiry.toISOString(),
        subscription_type: "annual",
        ...(monthlyPreapprovalId && cancelledMonthly ? { mp_preapproval_id: null } : {}),
        plan_type: planKey ?? "crecimiento",
        gym_status: "active",
      })
      .eq("id", gymId);

    console.log(`MP webhook: gym ${gymId} → annual payment ${paymentId} → activo hasta ${annualExpiry.toISOString().slice(0, 10)}`);
    await supabaseAdmin.from("mp_webhook_log").update({ status: "processed" }).eq("id", claimRow.id);

    createResellerCommission(
      gymId,
      payment.transaction_amount ?? 0,
      `mp_payment:${paymentId}`,
      "annual",
      periodMonthFrom(payment.date_approved ?? payment.date_created ?? null),
    ).catch(() => {});

    // WA de confirmación al dueño
    const motorUrl = process.env.WA_MOTOR_URL;
    {
      const { data: settings } = await supabaseAdmin
        .from("gym_settings")
        .select("gym_name, whatsapp")
        .eq("gym_id", gymId)
        .maybeSingle();
      if (settings?.whatsapp) {
        const msg =
          `🎉 *¡Tu Plan Anual FitGrowX está activo!*\n\n` +
          `✅ 12 meses de acceso garantizado\n` +
          `📅 Válido hasta el ${annualExpiry.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}\n\n` +
          `Gracias por confiar en FitGrowX. ¡A hacer crecer ${settings.gym_name ?? "tu gym"}! 💪`;
        void sendWa(gymId, settings.whatsapp, msg, { route: "mp/webhook" });
      }

      if (monthlyPreapprovalId && !cancelledMonthly) {
        const ownerPhone = normalizePhone((process.env.OWNER_PHONE ?? process.env.ALERT_PHONE));
        if (ownerPhone) {
          const alertMsg =
            `⚠️ *Preapproval mensual sin cancelar — Acción requerida*\n\n` +
            `Gym: *${settings?.gym_name ?? gymId}* (ID: ${gymId})\n` +
            `Preapproval mensual activo: ${monthlyPreapprovalId}\n\n` +
            `Cancelarlo manualmente en la cuenta MP de FitGrowX para evitar doble cobro al gym.`;
          void sendWa("fitgrowx-platform", ownerPhone, alertMsg, { route: "mp/webhook" });
        } else {
          void logger.error("MP webhook: OWNER_PHONE no configurado — preapproval mensual requiere cancelación manual", { route: "/api/mp/webhook", meta: { gymId, preapprovalId: monthlyPreapprovalId } });
        }
      }
    }

    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (type === "subscription_authorized_payment" && data?.id) {
    logWebhookPlatform(null, String(data.id), "subscription_authorized_payment", "received");

    const authorizedPaymentResult = await fetchMpWithTimeout(`https://api.mercadopago.com/authorized_payments/${data.id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      retryable: true,
    });
    if (!authorizedPaymentResult.ok) {
      void logger.error("MP webhook: no se pudo consultar authorized payment", { route: "/api/mp/webhook", meta: { authorizedPaymentId: data.id, error: String(authorizedPaymentResult.error) } });
      return NextResponse.json({ error: "mp_api_error" }, { status: 500 });
    }

    const authorizedPayment = authorizedPaymentResult.data as any;
    console.log("[mp-webhook-authorized-payment]", JSON.stringify({
      id: data.id,
      authorizedPayment,
      timestamp: new Date().toISOString(),
    }));

    const payment = authorizedPayment.payment;
    if (!payment) {
      console.log(`MP webhook: authorized payment ${data.id} payment pending`);
      return NextResponse.json({ ok: true });
    }

    if (payment.status !== "approved") {
      console.log(`MP webhook: authorized payment ${data.id} ignored with status ${payment.status ?? "unknown"}`);
      return NextResponse.json({ ok: true });
    }

    if (!payment.id) {
      console.log(`MP webhook: authorized payment ${data.id} approved without payment id`);
      return NextResponse.json({ ok: true });
    }

    const extParts = (authorizedPayment.external_reference ?? "").split("|");
    let gymId = extParts[0] || null;

    if (!gymId && authorizedPayment.preapproval_id) {
      const { data: gym } = await supabaseAdmin
        .from("gyms")
        .select("id")
        .eq("mp_preapproval_id", String(authorizedPayment.preapproval_id))
        .maybeSingle();
      gymId = gym?.id ?? null;
    }

    if (!gymId) {
      void logger.error("MP webhook: authorized payment sin gym_id", { route: "/api/mp/webhook", meta: { authorizedPaymentId: data.id, preapprovalId: authorizedPayment.preapproval_id ?? null } });
      logWebhookPlatform(null, String(data.id), "subscription_authorized_payment", "error", "missing gym_id");
      return NextResponse.json({ ok: true });
    }

    // Idempotency: insert-first claim for subscription payment.
    const { data: claimRow, error: claimErr } = await supabaseAdmin
      .from("mp_webhook_log")
      .insert({
        source:     "platform",
        gym_id:     gymId,
        payment_id: String(payment.id),
        event_type: "subscription_authorized_payment",
        status:     "processing",
      })
      .select("id")
      .single();

    if (claimErr) {
      if (claimErr.code === "23505") return NextResponse.json({ ok: true });
      void logger.error("MP webhook: failed to claim authorized payment", { route: "/api/mp/webhook", meta: { paymentId: payment.id, error: claimErr.message } });
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    const { data: subGym } = await supabaseAdmin
      .from("gyms")
      .select("subscription_expires_at")
      .eq("id", gymId)
      .maybeSingle();
    const curExp = subGym?.subscription_expires_at ? new Date(subGym.subscription_expires_at) : null;
    const base = curExp && curExp > new Date() ? curExp : new Date();
    await supabaseAdmin
      .from("gyms")
      .update({
        is_subscription_active: true,
        subscription_expires_at: addOneMonth(base).toISOString(),
        gym_status: "active",
      })
      .eq("id", gymId);

    await createResellerCommission(
      gymId,
      authorizedPayment.transaction_amount ?? 0,
      `mp_payment:${payment.id}`,
      "monthly",
      periodMonthFrom(authorizedPayment.debit_date ?? null),
    );
    await supabaseAdmin.from("mp_webhook_log").update({ status: "processed" }).eq("id", claimRow.id);

    return NextResponse.json({ ok: true });
  }

  if (type !== "preapproval" || !data?.id) return NextResponse.json({ ok: true });
  logWebhookPlatform(null, String(data.id), "preapproval", "received");

  // Fetch current preapproval state from MP
  const mpResult = await fetchMpWithTimeout(`https://api.mercadopago.com/preapproval/${data.id}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    retryable: true,
  });
  if (!mpResult.ok) {
    // Transient MP API error — return 500 so MP retries
    void logger.error("MP webhook: no se pudo consultar preapproval", { route: "/api/mp/webhook", meta: { preapprovalId: data.id } });
    return NextResponse.json({ error: "mp_api_error" }, { status: 500 });
  }

  const preapproval = mpResult.data as any;
  const { id, status, external_reference } = preapproval;

  const extParts = (external_reference ?? "").split("|");
  const gymId   = extParts[0];
  const planKey = extParts[1] ?? "crecimiento";
  if (!gymId) return NextResponse.json({ ok: true });

  const isActive    = status === "authorized";
  const isCancelled = status === "cancelled" || status === "paused";

  // ── Idempotency check ──────────────────────────────────────────────────────
  // If the preapproval ID matches and status hasn't changed, skip the update.
  // MP resends the same event on retries; processing it twice is harmless but
  // calculating addOneMonth(new Date()) on a retry would push the expiry further.
  const { data: currentGym } = await supabaseAdmin
    .from("gyms")
    .select("mp_preapproval_id, is_subscription_active, subscription_expires_at")
    .eq("id", gymId)
    .maybeSingle();

  const alreadyActive    = currentGym?.is_subscription_active === true;
  const alreadyCancelled = currentGym?.is_subscription_active === false && currentGym?.mp_preapproval_id === id;

  if (isActive && alreadyActive && currentGym?.mp_preapproval_id === id) {
    // Same preapproval, already active — idempotent, nothing to do
    return NextResponse.json({ ok: true });
  }
  if (isCancelled && alreadyCancelled) {
    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Extend expiry from current value if still in the future, otherwise from today.
  // This ensures a late retry doesn't push the expiry beyond what was actually paid.
  const currentExpiry = currentGym?.subscription_expires_at
    ? new Date(currentGym.subscription_expires_at)
    : null;
  const base = currentExpiry && currentExpiry > new Date() ? currentExpiry : new Date();
  const newExpiry = addOneMonth(base).toISOString();

  const { error: dbErr } = await supabaseAdmin
    .from("gyms")
    .update({
      mp_preapproval_id: id,
      is_subscription_active: isActive,
      ...(isActive ? {
        subscription_expires_at: newExpiry,
        plan_type: planKey,
        gym_status: "active",
      } : {}),
      ...(isCancelled ? {
        is_subscription_active: false,
        subscription_expires_at: new Date().toISOString(), // expirado → el gating bloquea
        gym_status: "cancelled",
      } : {}),
    })
    .eq("id", gymId);

  if (dbErr) {
    void logger.error("MP webhook: DB update failed on preapproval", { route: "/api/mp/webhook", meta: { gymId, error: dbErr.message } });
    logWebhookPlatform(gymId, id, "preapproval", "error", dbErr.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  console.log(`MP webhook: gym ${gymId} → preapproval ${id} → ${status}`);
  logWebhookPlatform(gymId, id, "preapproval", "processed");

  // Commission is only created on subscription_authorized_payment (actual confirmed payment),
  // NOT on preapproval (authorization only — no money collected yet). Creating on both events
  // would double-count because the refs differ and the unique constraint wouldn't catch it.

  // ── Bonus de referido: aplica solo en el primer pago (alreadyActive era false) ──
  if (isActive && !alreadyActive) {
    (async () => {
      try {
        const { data: referral } = await supabaseAdmin
          .from("referrals")
          .select("id, referrer_gym_id")
          .eq("referred_gym_id", gymId)
          .eq("status", "registered")
          .maybeSingle();

        if (referral?.referrer_gym_id && referral.referrer_gym_id !== gymId) {
          // Extender suscripción del referente 1 mes
          const { data: referrerGym } = await supabaseAdmin
            .from("gyms")
            .select("subscription_expires_at, is_subscription_active")
            .eq("id", referral.referrer_gym_id)
            .maybeSingle();

          const refBase = referrerGym?.subscription_expires_at && new Date(referrerGym.subscription_expires_at) > new Date()
            ? new Date(referrerGym.subscription_expires_at)
            : new Date();
          const refNewExpiry = addOneMonth(refBase).toISOString();

          await supabaseAdmin
            .from("gyms")
            .update({ subscription_expires_at: refNewExpiry, is_subscription_active: true })
            .eq("id", referral.referrer_gym_id);

          await supabaseAdmin
            .from("referrals")
            .update({ status: "rewarded", rewarded_at: new Date().toISOString() })
            .eq("id", referral.id);

          console.log(`MP webhook: referral bonus → gym ${referral.referrer_gym_id} extendido hasta ${refNewExpiry}`);

          // Notificar al referente por WA (fire-and-forget)
          {
            const { data: refSettings } = await supabaseAdmin
              .from("gym_settings")
              .select("gym_name, whatsapp")
              .eq("gym_id", referral.referrer_gym_id)
              .maybeSingle();
            if (refSettings?.whatsapp) {
              const msg = `🎁 *¡Ganaste 1 mes gratis!* Uno de los gyms que recomendaste a FitGrowX acaba de activar su suscripción. Tu acceso se extendió hasta el ${refNewExpiry.slice(0, 10)}. ¡Gracias por recomendar FitGrowX! 🙌`;
              void sendWa(referral.referrer_gym_id, refSettings.whatsapp, msg, { route: "mp/webhook" });
            }
          }
        }
      } catch (err) {
        void logger.error("MP webhook: referral bonus error", { route: "/api/mp/webhook", meta: { gymId, error: err instanceof Error ? err.message : String(err) } });
      }
    })();
  }

  if (isCancelled) {
    // Cancel pending commissions — already-paid commissions are left intact.
    void supabaseAdmin
      .from("reseller_commissions")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("gym_id", gymId)
      .eq("status", "pending");

    const { data: settings } = await supabaseAdmin
      .from("gym_settings")
      .select("gym_name, whatsapp")
      .eq("gym_id", gymId)
      .maybeSingle();
    if (settings?.whatsapp) {
      const gymName = settings?.gym_name ?? "tu gimnasio";
      const appUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");
      const message = `⚠️ *${gymName}* — Hubo un problema con el pago de tu suscripción FitGrowX y tu acceso fue suspendido.\n\nPodés renovarla en: ${appUrl}/dashboard/suscripcion\n\nSi tenés dudas, escribinos a soporte@fitgrowx.com.`;
      await sendWa(gymId, settings.whatsapp, message, { route: "mp/webhook" });
    }
  }

  return NextResponse.json({ ok: true });
}

export const POST = withApiHandler(handlePost);

export async function GET() {
  return NextResponse.json({ ok: true });
}
