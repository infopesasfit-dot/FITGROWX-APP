import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { bookingFormToSchema } from "@/lib/api/mappers";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";

interface BookingFormInput {
  classId: unknown;
  leadName: unknown;
  leadPhone: unknown;
  gymId: unknown;
  turnstileToken: unknown;
}

export async function POST(req: NextRequest) {
  const raw = await req.json() as unknown as BookingFormInput;
  const mapped = bookingFormToSchema({
    classId: raw.classId,
    leadName: raw.leadName,
    leadPhone: raw.leadPhone,
    gymId: raw.gymId,
    turnstileToken: raw.turnstileToken,
  });
  const { reservaBookSchema, parseBody } = await import("@/lib/schemas");
  const parsed = parseBody(reservaBookSchema, mapped);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const { class_id, lead_name, lead_phone, gym_id, turnstile_token } = parsed.data;
  const ip = getClientIp(req);

  const cleanPhone = normalizePhone(String(lead_phone));
  if (cleanPhone.length < 8) {
    return NextResponse.json({ error: "Ingresá un teléfono válido." }, { status: 400 });
  }

  const ipLimit = await applyRateLimit({
    namespace: "booking:ip",
    identifier: normalizeIdentifier(ip),
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
  });

  if (!ipLimit.allowed) {
    return NextResponse.json({ error: "Recibimos demasiadas reservas desde esta conexión. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const reservationLimit = await applyRateLimit({
    namespace: "booking:phone",
    identifier: `${class_id}:${cleanPhone}`,
    windowMs: 30 * 60 * 1000,
    maxAttempts: 2,
  });

  if (!reservationLimit.allowed) {
    return NextResponse.json({ error: "Ya recibimos una reserva reciente para este número. Si necesitás ayuda, contactá al gym." }, { status: 429 });
  }

  const turnstileResult = await verifyTurnstileToken(req, turnstile_token);
  if (!turnstileResult.ok) {
    return NextResponse.json({ error: turnstileResult.error }, { status: turnstileResult.status });
  }

  const supabase = getSupabaseAdminClient();

  // Verificar cupos disponibles
  const { data: cls } = await supabase
    .from("gym_classes")
    .select("class_name, start_time, day_of_week, max_capacity")
    .eq("id", class_id)
    .single();

  if (!cls) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

  const { count } = await supabase
    .from("class_reservations")
    .select("*", { count: "exact", head: true })
    .eq("class_id", class_id);

  if ((count ?? 0) >= cls.max_capacity) {
    return NextResponse.json({ error: "La clase ya está completa" }, { status: 409 });
  }

  // Guardar reserva
  const { data: existingReservation } = await supabase
    .from("class_reservations")
    .select("id")
    .eq("class_id", class_id)
    .eq("lead_phone", cleanPhone)
    .maybeSingle();

  if (existingReservation) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error: insertError } = await supabase
    .from("class_reservations")
    .insert({ class_id: class_id, lead_name: lead_name.trim(), lead_phone: cleanPhone });

  if (insertError) {
    // Unique violation = reserva duplicada (race condition entre requests)
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    // Capacity exceeded via DB trigger/check
    if (insertError.code === "23514" || insertError.message?.includes("max_capacity")) {
      return NextResponse.json({ error: "La clase ya está completa" }, { status: 409 });
    }
    console.error("[book] insert error:", insertError.message);
    return NextResponse.json({ error: "Error al guardar la reserva" }, { status: 500 });
  }

  // Próxima ocurrencia del día de la clase
  const today = new Date();
  const daysUntil = (cls.day_of_week - today.getDay() + 7) % 7;
  const classDate = new Date(today);
  classDate.setDate(today.getDate() + daysUntil);
  const claseDateStr = classDate.toISOString().slice(0, 10);

  // Upsert prospecto — entra directo al flujo Clase de Prueba
  try {
    const { data: existing } = await supabase
      .from("prospectos")
      .select("id, clase_gratis_date")
      .eq("gym_id", gym_id)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existing) {
      if (!existing.clase_gratis_date) {
        await supabase.from("prospectos")
          .update({ clase_gratis_date: claseDateStr, clase_gratis_status: "registrado", full_name: lead_name.trim() })
          .eq("id", existing.id);
      }
    } else {
      await supabase.from("prospectos").insert({
        gym_id:              gym_id,
        full_name:           lead_name.trim(),
        phone:               cleanPhone,
        status:              "pendiente",
        contactos_step:      3, // saltea Nuevos Contactos, ya reservó clase
        clase_gratis_date:   claseDateStr,
        clase_gratis_status: "registrado",
      });
    }

    await supabase.from("notifications").insert([{
      gym_id: gym_id,
      type:   "new_prospecto",
      title:  `Nueva reserva: ${lead_name.trim()}`,
      body:   `Clase de prueba el ${claseDateStr} · ${cleanPhone}`,
    }]);
  } catch (e) { console.error("[book] prospecto/notif upsert failed:", e instanceof Error ? e.message : e); }

  // Enviar confirmación por WhatsApp
  {
    const days = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const hora = cls.start_time.slice(0, 5);
    const dia  = days[cls.day_of_week];
    const msg  = `¡Hola ${lead_name}! ✅ Tu reserva para *${cls.class_name}* el ${dia} a las ${hora}hs está confirmada. ¡Te esperamos! 💪`;
    void sendWa(gym_id, cleanPhone, msg, { route: "reserva/book" });
  }

  return NextResponse.json({ ok: true });
}
