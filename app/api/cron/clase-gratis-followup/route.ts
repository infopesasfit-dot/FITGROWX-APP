import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { logWASend } from "@/lib/wa-log";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

function fillTemplate(template: string, nombre: string, gym: string, link = ""): string {
  return template
    .replace(/\{nombre\}/g, nombre)
    .replace(/\[Nombre\]/g,  nombre)
    .replace(/\{gym\}/g,     gym)
    .replace(/\[Gym\]/g,     gym)
    .replace(/\{link\}/g,    link)
    .replace(/\[Link\]/g,    link);
}

const DEFAULT_MSG_REMINDER = `¡Hola {nombre}! 👋 Te recordamos que *mañana* es tu clase de prueba en *{gym}*. ¡Te esperamos! 💪\n\n📍 Si no podés venir, avisanos para reagendar.`;
const DEFAULT_MSG_0 = `¡Hola {nombre}! 💪 ¿Cómo te fue en la clase de hoy en *{gym}*? ¡Esperamos que la hayas disfrutado! Cualquier pregunta, escribinos.`;
const DEFAULT_MSG_2 = `¡Hola {nombre}! 👋 Ya pasaron un par de días desde tu clase de prueba en *{gym}*. ¿Qué te pareció? Si querés arrancar, te dejamos la info acá 👇\n\n{link}`;
const DEFAULT_MSG_5 = `{nombre}, ¡tu clase de prueba en *{gym}* fue hace 5 días! 🎯 Este es el momento. Arrancá acá 👇\n\n{link}`;
const DEFAULT_MSG_NOSHOW = `Hola {nombre} 👋 Vimos que no pudiste venir a tu clase de prueba en *{gym}*. ¿Querés reagendar? Elegí tu día acá 👇\n\n{link}`;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const today = new Date();

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, clase_gratis_msg_0, clase_gratis_msg_2, clase_gratis_msg_5, clase_gratis_msg_noshow, slug, mp_access_token, payment_info")
    .eq("clase_gratis_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, log: ["No hay gyms con clase gratis activo."] });

  const log: string[] = [];
  let totalEnviados = 0;

  for (const gym of gyms) {
    const { data: prospectos } = await supabase
      .from("prospectos")
      .select("id, full_name, phone, clase_gratis_date, followup_step, clase_gratis_status")
      .eq("gym_id", gym.gym_id)
      .not("clase_gratis_date", "is", null)
      .in("clase_gratis_status", ["registrado", "asistio", "no_show"])
      .lt("followup_step", 3)
      .not("phone", "is", null);

    if (!prospectos?.length) continue;

    for (const p of prospectos) {
      if (!p.clase_gratis_date || !p.phone) continue;

      const classDate = new Date(p.clase_gratis_date + "T00:00:00");
      const diffDays = Math.floor((today.getTime() - classDate.getTime()) / 86_400_000);
      const gymName = gym.gym_name ?? "el gym";

      // Day-before reminder: class is tomorrow, not yet reminded (step === 0)
      if (p.clase_gratis_status === "registrado" && diffDays === -1 && p.followup_step === 0) {
        const msgTemplate = fillTemplate(DEFAULT_MSG_REMINDER, p.full_name, gymName);
        try {
          const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
            body: JSON.stringify({ phone: normalizePhone(p.phone!), message: msgTemplate }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.ok) {
            await supabase.from("prospectos").update({ followup_step: -1 }).eq("id", p.id);
            logWASend(supabase, gym.gym_id, "clase_gratis");
            totalEnviados++;
            log.push(`🔔 ${p.full_name} (${gymName}) — recordatorio día anterior`);
          } else {
            log.push(`✗ ${p.full_name} — recordatorio HTTP ${res.status}`);
          }
        } catch (e) {
          log.push(`✗ ${p.full_name} — recordatorio ${e instanceof Error ? e.message : "error"}`);
        }
        continue;
      }

      // Auto no-show: class passed and staff never marked attendance
      if (p.clase_gratis_status === "registrado" && diffDays >= 1) {
        await supabase.from("prospectos").update({ clase_gratis_status: "no_show" }).eq("id", p.id);
        p.clase_gratis_status = "no_show";
        log.push(`⚙ ${p.full_name} (${gymName}) — auto no_show (día ${diffDays})`);
      }

      let msgTemplate: string | null = null;
      let nextStep: number | null = null;

      if (p.clase_gratis_status === "asistio") {
        // step <= 0 covers both: reminder sent (-1) and no reminder sent (0)
        if (p.followup_step <= 0 && diffDays >= 0) {
          msgTemplate = gym.clase_gratis_msg_0 === "" ? null : (gym.clase_gratis_msg_0?.trim() || DEFAULT_MSG_0);
          nextStep = 1;
        } else if (p.followup_step === 1 && diffDays >= 2) {
          msgTemplate = gym.clase_gratis_msg_2 === "" ? null : (gym.clase_gratis_msg_2?.trim() || DEFAULT_MSG_2);
          nextStep = 2;
        } else if (p.followup_step === 2 && diffDays >= 5) {
          msgTemplate = gym.clase_gratis_msg_5 === "" ? null : (gym.clase_gratis_msg_5?.trim() || DEFAULT_MSG_5);
          nextStep = 3;
        }
      } else if (p.clase_gratis_status === "no_show") {
        if (p.followup_step <= 0 && diffDays >= 1) {
          msgTemplate = gym.clase_gratis_msg_noshow === "" ? null : (gym.clase_gratis_msg_noshow?.trim() || DEFAULT_MSG_NOSHOW);
          nextStep = 3;
        }
      }

      if (nextStep === null) continue;
      // Desactivado: avanzar step sin enviar
      if (!msgTemplate) {
        const upd: Record<string, unknown> = { followup_step: nextStep };
        if (nextStep === 3) upd.clase_gratis_status = "perdido";
        await supabase.from("prospectos").update(upd).eq("id", p.id);
        log.push(`⏭ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} saltado (desactivado)`);
        continue;
      }

      const reservarLink = gym.slug ? `${APP_URL}/gym/${gym.slug}/reservar` : "";
      // Remove {link} placeholder lines when gym has no slug
      const msgTemplateSanitized = reservarLink
        ? msgTemplate
        : msgTemplate.replace(/\n*\{link\}/g, "").replace(/\{link\}\n*/g, "");
      const paymentSuffix = p.clase_gratis_status === "asistio"
        ? gym.payment_info
          ? `\n\n💳 *Precios y planes:*\n${gym.payment_info}`
          : gym.mp_access_token
            ? `\n\n💳 Podés pagar online con MercadoPago al inscribirte.`
            : ""
        : "";
      const message = fillTemplate(msgTemplateSanitized + paymentSuffix, p.full_name, gymName, reservarLink);
      const phone = normalizePhone(p.phone);

      try {
        const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
          body: JSON.stringify({ phone, message }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          const updates: Record<string, unknown> = { followup_step: nextStep };
          if (nextStep === 3) updates.clase_gratis_status = "perdido";
          await supabase.from("prospectos").update(updates).eq("id", p.id);
          logWASend(supabase, gym.gym_id, "clase_gratis");
          totalEnviados++;
          log.push(`✓ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} [${p.clase_gratis_status}] (día ${diffDays})`);
        } else {
          log.push(`✗ ${p.full_name} — HTTP ${res.status}`);
        }
      } catch (e) {
        log.push(`✗ ${p.full_name} — ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, log });
}
