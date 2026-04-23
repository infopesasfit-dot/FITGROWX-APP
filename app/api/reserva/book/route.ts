import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { classId, leadName, leadPhone, gymId } = await req.json();

  if (!classId || !leadName || !leadPhone || !gymId) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

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
  const { error: insertError } = await supabase
    .from("class_reservations")
    .insert({ class_id: classId, lead_name: leadName, lead_phone: leadPhone });

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
        body: JSON.stringify({ phone: leadPhone, message: msg }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      // No es fatal — la reserva ya se guardó
    }
  }

  return NextResponse.json({ ok: true });
}
