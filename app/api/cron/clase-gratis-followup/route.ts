import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeArgPhone(raw: string): string {
  const p = raw.replace(/\D/g, "");
  if (p.startsWith("549") && p.length === 13) return p;
  if (p.startsWith("54")  && p.length === 12) return "549" + p.slice(2);
  if (p.startsWith("9")   && p.length === 11) return "54" + p;
  if (p.startsWith("0")   && p.length === 11) return "549" + p.slice(1);
  if (p.length === 10) return "549" + p;
  return p;
}

function fillTemplate(template: string, nombre: string, gym: string): string {
  return template
    .replace(/\{nombre\}/g, nombre)
    .replace(/\[Nombre\]/g,  nombre)
    .replace(/\{gym\}/g,     gym)
    .replace(/\[Gym\]/g,     gym);
}

const DEFAULT_MSG_0 = `¡Hola {nombre}! 💪 ¿Cómo te fue en la clase de hoy en *{gym}*? ¡Esperamos que la hayas disfrutado! Cualquier pregunta, escribinos.`;
const DEFAULT_MSG_2 = `¡Hola {nombre}! 👋 Ya pasaron un par de días desde tu clase de prueba en *{gym}*. ¿Qué te pareció? Te contamos nuestros planes para que puedas arrancar cuando quieras 💥`;
const DEFAULT_MSG_5 = `{nombre}, ¡tu clase de prueba en *{gym}* fue hace 5 días! 🎯 Si estás listo para arrancar de verdad, este es el momento. ¿Arrancamos?`;
const DEFAULT_MSG_NOSHOW = `Hola {nombre} 👋 Vimos que no pudiste venir a tu clase de prueba en *{gym}*. ¿Querés reagendar para esta semana?`;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const today = new Date();

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, clase_gratis_msg_0, clase_gratis_msg_2, clase_gratis_msg_5, clase_gratis_msg_noshow")
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

      // Auto no-show: class passed and staff never marked attendance
      if (p.clase_gratis_status === "registrado" && diffDays >= 1) {
        await supabase.from("prospectos").update({ clase_gratis_status: "no_show" }).eq("id", p.id);
        p.clase_gratis_status = "no_show";
        log.push(`⚙ ${p.full_name} (${gymName}) — auto no_show (día ${diffDays})`);
      }

      let msgTemplate: string | null = null;
      let nextStep: number | null = null;

      if (p.clase_gratis_status === "asistio") {
        if (p.followup_step === 0 && diffDays >= 0) {
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
        if (p.followup_step === 0 && diffDays >= 1) {
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

      const message = fillTemplate(msgTemplate, p.full_name, gymName);
      const phone = normalizeArgPhone(p.phone);

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
