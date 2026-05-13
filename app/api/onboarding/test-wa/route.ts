import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const { phone, nombre, gymName } = await req.json();
  if (!phone?.trim()) return NextResponse.json({ ok: false, error: "Teléfono requerido." }, { status: 400 });

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ ok: false, error: "Motor no configurado." }, { status: 503 });

  const digits = String(phone).replace(/\D/g, "");
  const normalized = digits.startsWith("549") ? digits : digits.startsWith("54") ? "549" + digits.slice(2) : "549" + digits;

  const displayNombre = (nombre ?? "").split(" ")[0] || "Profe";
  const displayGym    = gymName?.trim() || "tu gym";

  const message =
    `💪 *¡Hola ${displayNombre}!*\n\n` +
    `Este es un mensaje de prueba de *FitGrowX*.\n\n` +
    `Desde ahora *${displayGym}* puede enviarle mensajes como éste a sus alumnos automáticamente:\n` +
    `✅ Recordatorios de vencimiento\n` +
    `✅ Bienvenida al primer día\n` +
    `✅ Avisos de inactividad\n\n` +
    `¡Todo sin que tengas que escribir nada! 🚀`;

  try {
    const res = await fetch(`${motorUrl}/send/fitgrowx-platform`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.WA_MOTOR_API_KEY ?? "",
      },
      body: JSON.stringify({ phone: normalized, message }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[test-wa] motor error:", err);
      return NextResponse.json({ ok: false, error: "No se pudo enviar. Verificá que el número esté en WhatsApp." }, { status: 502 });
    }

    // Marcar en platform_accounts que el aha moment fue completado
    const admin = getSupabaseAdminClient();
    await admin
      .from("platform_accounts")
      .update({ wa_test_sent_at: new Date().toISOString() })
      .eq("auth_user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "El servidor de mensajes no respondió." }, { status: 504 });
  }
}
