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

const DEFAULT_MSG_1 = `¡Hola {nombre}! 👋 ¿Pudiste ver la info que te mandamos? Si tenés alguna duda sobre la clase de prueba en *{gym}*, estamos acá para ayudarte 😊`;
const DEFAULT_MSG_3 = `Hola {nombre}, último mensajito 🙌 Si en algún momento querés conocer *{gym}*, la puerta está abierta. ¡Éxitos!`;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "Motor WA no configurado." }, { status: 500 });

  const today = new Date();

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, contactos_msg_1, contactos_msg_3")
    .eq("lead_auto_welcome", true);

  if (!gyms?.length) return NextResponse.json({ ok: true, enviados: 0, log: ["No hay gyms con Nuevos Contactos activo."] });

  const log: string[] = [];
  let totalEnviados = 0;

  for (const gym of gyms) {
    // Leads on step 1 (day-0 sent) or step 2 (day-1 sent), no class scheduled yet
    const { data: prospectos } = await supabase
      .from("prospectos")
      .select("id, full_name, phone, created_at, contactos_step")
      .eq("gym_id", gym.gym_id)
      .in("contactos_step", [1, 2])
      .is("clase_gratis_date", null)
      .not("phone", "is", null);

    if (!prospectos?.length) continue;

    for (const p of prospectos) {
      if (!p.phone) continue;

      const createdAt = new Date(p.created_at);
      const diffDays = Math.floor((today.getTime() - createdAt.getTime()) / 86_400_000);
      const gymName = gym.gym_name ?? "el gym";

      let msgTemplate: string | null = null;
      let nextStep: number | null = null;

      if (p.contactos_step === 1 && diffDays >= 1) {
        if (gym.contactos_msg_1 === "") { nextStep = 2; msgTemplate = null; }
        else { msgTemplate = gym.contactos_msg_1?.trim() || DEFAULT_MSG_1; nextStep = 2; }
      } else if (p.contactos_step === 2 && diffDays >= 3) {
        if (gym.contactos_msg_3 === "") { nextStep = 3; msgTemplate = null; }
        else { msgTemplate = gym.contactos_msg_3?.trim() || DEFAULT_MSG_3; nextStep = 3; }
      }

      // Si está desactivado pero hay nextStep, avanzar el step sin enviar
      if (nextStep !== null && msgTemplate === null) {
        await supabase.from("prospectos").update({ contactos_step: nextStep }).eq("id", p.id);
        log.push(`⏭ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} saltado (desactivado)`);
        continue;
      }

      if (!msgTemplate || nextStep === null) continue;

      const message = msgTemplate
        .replace(/\{nombre\}/g, p.full_name)
        .replace(/\{gym\}/g, gymName);

      const phone = normalizeArgPhone(p.phone);

      try {
        const res = await fetch(`${motorUrl}/send/${gym.gym_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
          body: JSON.stringify({ phone, message }),
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          await supabase.from("prospectos").update({ contactos_step: nextStep }).eq("id", p.id);
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
