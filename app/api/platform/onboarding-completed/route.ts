import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { sendWa } from "@/lib/wa";

export const dynamic = "force-dynamic";

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

function toWhatsAppDigits(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("54") && !digits.startsWith("549")) {
    const local = digits.slice(2).replace(/^0+/, "").replace(/^15/, "");
    return `549${local}`;
  }

  return digits;
}

function buildWhatsAppLink(value: string | null | undefined) {
  const digits = toWhatsAppDigits(value);
  return digits ? `https://wa.me/${digits}` : null;
}

export async function POST(req: NextRequest) {
  try {
    const { gymId } = (await req.json()) as { gymId?: string };
    if (!gymId) return NextResponse.json({ error: "Missing gymId" }, { status: 400 });

    const userClient = await createSupabaseServerClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

    const sb = getSupabaseAdminClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("id, gym_id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.gym_id !== gymId || profile.role !== "admin") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }

    const [{ data: settings }, { data: gym }, { data: account }] = await Promise.all([
      sb
        .from("gym_settings")
        .select("gym_id, owner_name, gym_name, whatsapp, email, onboarding_completed")
        .eq("gym_id", gymId)
        .maybeSingle(),
      sb
        .from("gyms")
        .select("id, name, gym_name, owner_name, whatsapp, email, trial_start_date, trial_expires_at")
        .eq("id", gymId)
        .maybeSingle(),
      sb
        .from("platform_accounts")
        .select("id, owner_alert_sent_at, trial_starts_at, trial_ends_at")
        .eq("auth_user_id", user.id)
        .maybeSingle(),
    ]);

    if (!settings?.onboarding_completed) {
      return NextResponse.json({ ok: true, skipped: "onboarding_not_completed" });
    }

    if (account?.owner_alert_sent_at) {
      return NextResponse.json({ ok: true, skipped: "already_sent" });
    }

    if (!account?.id) {
      void logger.warn("owner alert skipped: missing platform account", {
        route: "platform/onboarding-completed",
        meta: { gymId, userId: user.id },
      });
      return NextResponse.json({ ok: true, skipped: "missing_platform_account" });
    }

    const ownerName = settings.owner_name?.trim() || profile.full_name?.trim() || gym?.owner_name?.trim() || "";
    const gymName = settings.gym_name?.trim() || gym?.gym_name?.trim() || gym?.name?.trim() || "Nuevo espacio FitGrowX";
    const email = settings.email?.trim() || gym?.email?.trim() || user.email?.trim() || "";
    const whatsapp = settings.whatsapp?.trim() || gym?.whatsapp?.trim() || "";
    const whatsappLink = buildWhatsAppLink(whatsapp);
    const trialStart = gym?.trial_start_date ?? account.trial_starts_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const trialEnd = gym?.trial_expires_at?.slice(0, 10) ?? account.trial_ends_at?.slice(0, 10) ?? "—";

    const resendKey = process.env.RESEND_API_KEY;
    const alertEmail = process.env.ALERT_EMAIL ?? "elianafrancoanahi@gmail.com";

    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: "FitGrowX <radar@fitgrowx.com>",
            to: [alertEmail],
            subject: `🏋️ Nuevo gym registrado: ${gymName}`,
            text:
              `Nombre: ${valueOrDash(ownerName)}\n` +
              `Email: ${valueOrDash(email)}\n` +
              `WhatsApp: ${valueOrDash(whatsapp)}\n` +
              `Hablar por WhatsApp: ${whatsappLink ?? "—"}\n` +
              `Gym: ${gymName}\n` +
              `Trial hasta: ${trialEnd}\n\n` +
              `Ver en plataforma: https://fitgrowx.com/platform`,
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        void logger.error("Email alert failed after onboarding completed", {
          route: "platform/onboarding-completed",
          meta: { gymId, gymName, email, err: String(err) },
        });
      }
    }

    const ownerPhone = process.env.OWNER_PHONE ?? process.env.ALERT_PHONE;
    if (ownerPhone) {
      try {
        const normalizedOwnerPhone = toWhatsAppDigits(ownerPhone);
        if (normalizedOwnerPhone) {
          const msg =
            `🏋️ Nuevo gym registrado\n` +
            `Gym: ${gymName}\n` +
            `Dueño: ${valueOrDash(ownerName)}\n` +
            `Email: ${valueOrDash(email)}\n` +
            `Tel: ${valueOrDash(whatsapp)}\n` +
            `Hablar por WhatsApp: ${whatsappLink ?? "—"}\n` +
            `Trial desde: ${trialStart}`;
          await sendWa("fitgrowx-platform", normalizedOwnerPhone, msg, { route: "platform/onboarding-completed/owner-alert" });
        }
      } catch (err) {
        void logger.error("WA owner alert failed after onboarding completed", {
          route: "platform/onboarding-completed",
          meta: { gymId, gymName, err: String(err) },
        });
      }
    }

    await sb
      .from("platform_accounts")
      .update({
        owner_alert_sent_at: new Date().toISOString(),
        onboarding_stage: "completed",
        company_name: gymName,
        owner_name: ownerName || null,
        phone: whatsapp || null,
        email: email || null,
      })
      .eq("id", account.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    void logger.error("onboarding-completed unhandled error", {
      route: "platform/onboarding-completed",
      meta: { error: String(error) },
    });
    return NextResponse.json({ error: "Unexpected onboarding-completed error" }, { status: 500 });
  }
}
