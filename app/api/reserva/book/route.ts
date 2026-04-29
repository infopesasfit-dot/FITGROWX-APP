import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { verifyTurnstileToken } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  const { classId, leadName, leadPhone, gymId, turnstileToken } = await req.json();
  const ip = getClientIp(req);

  if (!classId || !leadName || !leadPhone || !gymId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const cleanPhone = String(leadPhone).replace(/\D/g, "");
  if (cleanPhone.length < 8) {
    return NextResponse.json({ error: "Ingresá un teléfono válido." }, { status: 400 });
  }

  const ipLimit = applyRateLimit({
    namespace: "booking:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Recibimos demasiadas reservas desde esta conexión. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const reservationLimit = applyRateLimit({
    namespace: "booking:phone",
    identifier: `${classId}:${cleanPhone}`,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 2,
  });

  if (!reservationLimit.allowed) {
    return NextResponse.json({ error: "Ya recibimos una reserva reciente para este número. Si necesitás ayuda, contactá al gym." }, { status: 429 });
  }

  const turnstileResult = await verifyTurnstileToken(req, turnstileToken);
  if (!turnstileResult.ok) {
    return NextResponse.json({ error: turnstileResult.error }, { status: turnstileResult.status });
  }

  const supabase = getSupabaseAdminClient();

  // Verificar cupos disponibles
  const { data: cls } = await supabase
    .from("gym_classes")
    .select("class_name, start_time, day_of_week, max_capacity")
    .eq("id", classId)
    .single();

  if (!cls) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

  const { count } = await supabase
    .from("class_reservations")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId);

  if ((count ?? 0) >= cls.max_capacity) {
    return NextResponse.json({ error: "La clase ya está completa" }, { status: 409 });
  }

  // Guardar reserva
  const { data: existingReservation } = await supabase
    .from("class_reservations")
    .select("id")
    .eq("class_id", classId)
    .eq("lead_phone", cleanPhone)
    .maybeSingle();

  if (existingReservation) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error: insertError } = await supabase
    .from("class_reservations")
    .insert({ class_id: classId, lead_name: leadName.trim(), lead_phone: cleanPhone });

  if (insertError) {
    return NextResponse.json({ error: "Error al guardar la reserva" }, { status: 500 });
  }

  // Enviar confirmación por WhatsApp
  const motor = process.env.WA_MOTOR_URL;
  if (motor) {
    const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const hora = cls.start_time.slice(0, 5);
    const dia  = days[cls.day_of_week];
    const msg  = `¡Hola ${leadName}! ✅ Tu reserva para *${cls.class_name}* el ${dia} a las ${hora}hs está confirmada. ¡Te esperamos! 💪`;

    try {
      await fetch(`${motor}/send/${gymId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, message: msg }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // No es fatal — la reserva ya se guardó
    }
  }

  return NextResponse.json({ ok: true });
}
