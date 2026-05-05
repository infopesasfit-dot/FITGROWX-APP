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

const DEFAULT_MSG_0 = `¡Hola [Nombre]! 💪 ¿Cómo te fue en la clase de hoy en *[Gym]*? ¡Esperamos que la hayas disfrutado! Cualquier pregunta, escribinos.`;
const DEFAULT_MSG_2 = `¡Hola [Nombre]! 👋 Ya pasaron un par de días desde tu clase de prueba en *[Gym]*. ¿Qué te pareció? Te contamos nuestros planes para que puedas arrancar cuando quieras 💥`;
const DEFAULT_MSG_5 = `[Nombre], ¡tu clase de prueba en *[Gym]* fue hace 5 días! 🎯 Si estás listo para arrancar de verdad, este es el momento. ¿Arrancamos?`;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, clase_gratis_msg_0, clase_gratis_msg_2, clase_gratis_msg_5")
    .eq("clase_gratis_activo", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, log: ["No hay gyms con clase gratis activo."] });

  const log: string[] = [];
  let totalEnviados = 0;

  for (const gym of gyms) {
    const { data: prospectos } = await supabase
      .from("prospectos")
      .select("id, full_name, phone, clase_gratis_date, followup_step")
      .eq("gym_id", gym.gym_id)
      .not("clase_gratis_date", "is", null)
      .lt("followup_step", 3)
      .not("phone", "is", null);

    if (!prospectos?.length) continue;

    for (const p of prospectos) {
      if (!p.clase_gratis_date || !p.phone) continue;

      const classDate = new Date(p.clase_gratis_date + "T00:00:00");
      const diffDays = Math.floor((today.getTime() - classDate.getTime()) / 86_400_000);

      let msgTemplate: string | null = null;
      let nextStep: number | null = null;

      if (p.followup_step === 0 && diffDays === 0) {
        msgTemplate = gym.clase_gratis_msg_0?.trim() || DEFAULT_MSG_0;
        nextStep = 1;
      } else if (p.followup_step === 1 && diffDays >= 2) {
        msgTemplate = gym.clase_gratis_msg_2?.trim() || DEFAULT_MSG_2;
        nextStep = 2;
      } else if (p.followup_step === 2 && diffDays >= 5) {
        msgTemplate = gym.clase_gratis_msg_5?.trim() || DEFAULT_MSG_5;
        nextStep = 3;
      }

      if (!msgTemplate || nextStep === null) continue;

      const message = msgTemplate
        .replace(/\[Nombre\]/g, p.full_name)
        .replace(/\[Gym\]/g, gym.gym_name ?? "el gym");

      const phone = normalizeArgPhone(p.phone);

      try {
        const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
          body: JSON.stringify({ phone, message }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          await supabase.from("prospectos").update({ followup_step: nextStep }).eq("id", p.id);
          totalEnviados++;
          log.push(`✓ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} (día ${diffDays})`);
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
