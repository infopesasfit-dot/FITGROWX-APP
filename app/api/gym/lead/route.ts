import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { gymId, name, phone, email } = await req.json();

  if (!gymId || !name || !email) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Guardar lead en prospectos (upsert por email para evitar duplicados)
  const { error } = await supabase.from("prospectos").upsert(
    {
      gym_id:    gymId,
      full_name: name,
      phone:     phone || null,
      email:     email,
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
