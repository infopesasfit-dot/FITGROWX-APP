import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";
import { normalizePhone } from "@/lib/phone";
import { logWASend } from "@/lib/wa-log";
import { sendWa } from "@/lib/wa";
import { ensureGymBranding } from "@/lib/messaging-helpers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.fitgrowx.com").replace(/\/$/, "");

const DEFAULT_MSG_1 = `Hola {nombre}, soy del staff de {gym}. Vi que dejaste tus datos en la landing. ¿Cuándo te conviene probar una clase?`;
const DEFAULT_MSG_3 = `Hola {nombre}, soy del staff de {gym}. ¿Te quedan dudas sobre cómo entrenamos? Cualquier cosa pregúntame.`;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();


  const today = new Date();

  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, gym_name, contactos_msg_1, contactos_msg_3, slug, mp_access_token, payment_info")
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

      const msgTemplateBranded = ensureGymBranding(msgTemplate, gymName);
      const reservarLink = gym.slug ? `${APP_URL}/gym/${gym.slug}/reservar` : null;
      const paymentSuffix = gym.payment_info
        ? `\n\n💳 *Precios y planes:*\n${gym.payment_info}`
        : gym.mp_access_token
          ? `\n\n💳 Podés pagar online con MercadoPago al reservar.`
          : "";

      const message = (msgTemplateBranded + paymentSuffix)
        .replace(/\{nombre\}/g, p.full_name)
        .replace(/\{gym\}/g, gymName)
        .replace(/\{link\}/g, reservarLink ?? `Escribinos para coordinar`);

      const phone = normalizePhone(p.phone);

      const sent = await sendWa(gym.gym_id, phone, message, { route: "cron/contactos-followup" });
      if (!sent) {
        log.push(`⚠ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} WA falló, reintento próximo cron`);
        continue;
      }
      await supabase.from("prospectos").update({ contactos_step: nextStep }).eq("id", p.id);
      logWASend(supabase, gym.gym_id, "nuevo_contacto", p.id, p.full_name);
      totalEnviados++;
      log.push(`✓ ${p.full_name} (${gym.gym_name}) — paso ${nextStep} (día ${diffDays})`);
    }
  }

  return NextResponse.json({ ok: true, enviados: totalEnviados, log });
}
