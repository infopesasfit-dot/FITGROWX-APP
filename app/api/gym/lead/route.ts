import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createLeadSchema, parseBody } from "@/lib/schemas";
import { leadFormToSchema } from "@/lib/api/mappers";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";

interface LeadFormInput {
  gymId: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  turnstileToken: unknown;
}

export async function POST(req: NextRequest) {
  const raw = await req.json() as unknown as LeadFormInput;
  const mapped = leadFormToSchema({
    gymId: raw.gymId,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    turnstileToken: raw.turnstileToken,
  });
  const parsed = parseBody(createLeadSchema, mapped);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { gym_id, name, phone, email: emailNormalized, turnstile_token } = parsed.data;
  const ip = getClientIp(req);
  const ipLimit = await applyRateLimit({
    namespace: "lead:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 15 * 60 * 1000,
    maxAttempts: 8,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Recibimos demasiados intentos desde esta conexión. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const identityLimit = await applyRateLimit({
    namespace: "lead:identity",
    identifier: `${gym_id}:${emailNormalized}`,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 2,
  });

  if (!identityLimit.allowed) {
    return NextResponse.json({ ok: true });
  }

  const turnstileResult = await verifyTurnstileToken(req, turnstile_token);
  if (!turnstileResult.ok) {
    return NextResponse.json({ error: turnstileResult.error }, { status: turnstileResult.status });
  }

  const supabase = getSupabaseAdminClient();

  const { data: settings } = await supabase
    .from("gym_settings")
    .select("gym_name, lead_auto_welcome, contactos_msg_0, slug")
    .eq("gym_id", gym_id)
    .maybeSingle();

  // Guardar lead en prospectos (upsert por email para evitar duplicados)
  const { error } = await supabase.from("prospectos").upsert(
    {
      gym_id:         gym_id,
      full_name:      name,
      phone:          phone ? normalizePhone(phone) : null,
      email:          emailNormalized,
      status:         "pendiente",
      contactos_step: 0,
    },
    { onConflict: "gym_id,email", ignoreDuplicates: false },
  );

  if (error) {
    console.error("[LEAD] insert error:", error.message);
    return NextResponse.json({ error: "Error al guardar el registro" }, { status: 500 });
  }

  // Notificación: nuevo prospecto
  try {
    await supabase.from("notifications").insert([{
      gym_id: gym_id,
      type: "new_prospecto",
      title: `Nuevo prospecto: ${name}`,
      body: emailNormalized ?? phone ?? null,
    }]);
  } catch { /* non-fatal */ }

  // Enviar mensaje día-0 si WA configurado y automatización activa
  if (phone && settings?.lead_auto_welcome === true) {
    const gymName = settings?.gym_name ?? "el gym";
    const firstName = name.split(" ")[0];

    if (settings?.contactos_msg_0 !== "") {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      const reservarLink = settings?.slug && appUrl ? `${appUrl}/gym/${settings.slug}/reservar` : null;
      const DEFAULT_MSG_0 = reservarLink
        ? `¡Hola ${firstName}! 👋 Recibimos tu solicitud en *${gymName}*. Agendá tu clase de prueba acá 👇\n\n${reservarLink}`
        : `¡Hola ${firstName}! 👋 Recibimos tu solicitud de clase de prueba en *${gymName}*. Te contactamos pronto para coordinar el horario. ¡Nos vemos! 💪`;
      const msg = (settings?.contactos_msg_0?.trim() || DEFAULT_MSG_0)
        .replace(/\{nombre\}/gi, firstName)
        .replace(/\{gym\}/gi, gymName)
        .replace(/\{link\}/gi, reservarLink ?? "");

      void sendWa(gym_id, normalizePhone(phone), msg, { route: "gym/lead" });
    }

    // Avanzar step siempre para que los follow-ups puedan correr
    try {
      await supabase.from("prospectos")
        .update({ contactos_step: 1 })
        .eq("gym_id", gym_id)
        .eq("email", emailNormalized);
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true });
}
