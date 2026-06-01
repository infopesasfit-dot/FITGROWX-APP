import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { sendWa, isWaConnected } from "@/lib/wa";
import { canSendAutomatedWa } from "@/lib/gym-plan-status";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PLAT_SESSION = "fitgrowx-platform";

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return "549" + digits.slice(2);
  return "549" + digits;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const startedAt = Date.now();
  const log: string[] = [];

  if (!process.env.WA_MOTOR_URL) {
    void sb.from("cron_runs").insert({
      cron_name: "staff-payment-reminders",
      status: "error",
      duration_ms: Date.now() - startedAt,
      summary: "WA_MOTOR_URL no configurado",
    });
    return NextResponse.json({ ok: false, log: ["WA_MOTOR_URL no configurado."] });
  }

  if (!(await isWaConnected(PLAT_SESSION))) {
    void sb.from("cron_runs").insert({
      cron_name: "staff-payment-reminders",
      status: "error",
      duration_ms: Date.now() - startedAt,
      summary: "Sesión WA de plataforma no activa",
    });
    return NextResponse.json({ ok: false, log: ["Sesión WA de plataforma no activa."] });
  }

  const now = new Date();

  // Get all gyms with staff payment reminder enabled
  const { data: gyms } = await sb
    .from("gym_settings")
    .select(
      "gym_id, staff_payment_reminder_enabled, staff_payment_reminder_days, staff_payment_reminder_day_of_week, last_staff_payment_reminder_sent_at, last_staff_payment_registered_at"
    )
    .eq("staff_payment_reminder_enabled", true);

  if (!gyms || gyms.length === 0) {
    log.push("— No gyms with staff payment reminders enabled");
    void sb.from("cron_runs").insert({
      cron_name: "staff-payment-reminders",
      status: "ok",
      duration_ms: Date.now() - startedAt,
      summary: "No gyms with reminders enabled",
      counts: { log },
    });
    return NextResponse.json({ ok: true, log });
  }

  for (const settings of gyms) {
    try {
      const gymId = settings.gym_id;
      const canSend = await canSendAutomatedWa(gymId);
      if (!canSend) {
        log.push(`⏸ Gym ${gymId} — gym bloqueado (trial vencido o suscripción), saltado`);
        continue;
      }
      const reminderDays = settings.staff_payment_reminder_days || 14;
      const dayOfWeek = settings.staff_payment_reminder_day_of_week;
      const lastSent = settings.last_staff_payment_reminder_sent_at
        ? new Date(settings.last_staff_payment_reminder_sent_at)
        : null;
      const lastPaid = settings.last_staff_payment_registered_at
        ? new Date(settings.last_staff_payment_registered_at)
        : null;

      // Determine if should send
      let shouldSend = false;
      let reason = "";

      if (!lastSent && !lastPaid) {
        // First time, no payment registered yet
        shouldSend = true;
        reason = "First reminder (no payment history)";
      } else if (lastPaid) {
        // Has paid before - check if X days have passed since last payment
        const daysSincePayment = Math.floor(
          (now.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSincePayment >= reminderDays) {
          shouldSend = true;
          reason = `${daysSincePayment} days since last payment (threshold: ${reminderDays})`;
        }
      } else {
        // No payment registered, check if X days since first reminder
        const daysSinceReminder = lastSent
          ? Math.floor(
              (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;
        if (daysSinceReminder >= reminderDays) {
          shouldSend = true;
          reason = `${daysSinceReminder} days since last reminder`;
        }
      }

      // Check day-of-week if specified
      if (shouldSend && dayOfWeek !== null && dayOfWeek !== undefined) {
        if (now.getDay() !== dayOfWeek) {
          shouldSend = false;
          reason = `Wrong day of week (today: ${now.getDay()}, target: ${dayOfWeek})`;
        }
      }

      if (!shouldSend) {
        log.push(`— Gym ${gymId}: ${reason}`);
        continue;
      }

      // Get gym and owner phone
      const { data: gym } = await sb
        .from("gyms")
        .select("id, gym_name")
        .eq("id", gymId)
        .maybeSingle();

      if (!gym) {
        log.push(`✗ Gym ${gymId}: not found`);
        continue;
      }

      const { data: platformAccount } = await sb
        .from("platform_accounts")
        .select("phone, owner_name, company_name")
        .eq("gym_id", gymId)
        .maybeSingle();

      if (!platformAccount?.phone) {
        log.push(`— Gym ${gym.gym_name}: no phone`);
        continue;
      }

      const phone = normalizePhone(platformAccount.phone);
      if (!phone) {
        log.push(`— Gym ${gym.gym_name}: invalid phone`);
        continue;
      }

      const ownerName =
        platformAccount.owner_name?.split(" ")[0] ||
        platformAccount.company_name?.split(" ")[0] ||
        "dueño";
      const msg = `¡Hola ${ownerName}! 👋 Hace un tiempo que no registras pagos de sueldos a tu staff en FitGrowX. ¿Ya pagaste? Registralo en tu dashboard para tener todo al día 💪`;

      const result = await sendWa(PLAT_SESSION, phone, msg, {
        route: "cron/staff-payment-reminders",
      });

      if (result.ok) {
        // Record the reminder sent
        await sb.from("staff_payment_reminders").insert({
          gym_id: gymId,
          sent_at: now.toISOString(),
        });

        // Update last sent timestamp
        await sb
          .from("gym_settings")
          .update({ last_staff_payment_reminder_sent_at: now.toISOString() })
          .eq("gym_id", gymId);

        log.push(`✓ Staff payment reminder → ${gym.gym_name}`);
      } else {
        log.push(
          `✗ Gym ${gym.gym_name}: WA send failed (${result.statusCode})`
        );
      }
    } catch (err) {
      log.push(`✗ Error processing gym: ${err}`);
    }
  }

  log.push(`Completado: ${now.toISOString().slice(0, 10)}`);

  void sb.from("cron_runs").insert({
    cron_name: "staff-payment-reminders",
    status: "ok",
    duration_ms: Date.now() - startedAt,
    summary: `${log.filter(l => l.startsWith("✓")).length} reminders sent`,
    counts: { log },
  });

  return NextResponse.json({ ok: true, log });
}
