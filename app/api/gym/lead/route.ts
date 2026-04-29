import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  const { gymId, name, phone, email, turnstileToken } = await req.json();
  const ip = getClientIp(req);

  if (!gymId || !name || !email) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const emailNormalized = normalizeIdentifier(String(email));
  const ipLimit = applyRateLimit({
    namespace: "lead:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 15 * 60 * 1000,
    maxAttempts: 8,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Recibimos demasiados intentos desde esta conexión. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const identityLimit = applyRateLimit({
    namespace: "lead:identity",
    identifier: `${gymId}:${emailNormalized}`,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 2,
  });

  if (!identityLimit.allowed) {
    return NextResponse.json({ ok: true });
  }

  const turnstileResult = await verifyTurnstileToken(req, turnstileToken);
  if (!turnstileResult.ok) {
    return NextResponse.json({ error: turnstileResult.error }, { status: turnstileResult.status });
  }

  const supabase = getSupabaseAdminClient();

  // Guardar lead en prospectos (upsert por email para evitar duplicados)
  const { error } = await supabase.from("prospectos").upsert(
    {
      gym_id:    gymId,
      full_name: name,
      phone:     phone || null,
      email:     emailNormalized,
      status:    "pendiente",
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
      gym_id: gymId,
      type: "new_prospecto",
      title: `Nuevo prospecto: ${name}`,
      body: email ?? phone ?? null,
    }]);
  } catch { /* non-fatal */ }

  // Enviar bienvenida por WhatsApp si hay teléfono y motor configurado
  const motor = process.env.WA_MOTOR_URL;
  if (motor && phone) {
    try {
      const msg = `¡Hola ${name.split(" ")[0]}! 👋 Recibimos tu solicitud de clase gratis. Te vamos a contactar pronto para coordinar el horario. ¡Nos vemos! 💪`;
      await fetch(`${motor}/send/${gymId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message: msg }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // No es fatal
    }
  }

  return NextResponse.json({ ok: true });
}
