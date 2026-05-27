import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWa } from "@/lib/wa";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });

  const { phone, nombre, gymName } = await req.json();
  if (!phone?.trim()) return NextResponse.json({ ok: false, error: "Teléfono requerido." }, { status: 400 });

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

  // sendWa retorna { ok: boolean, ... } — usar .ok, NO el objeto.
  const ok = await sendWa("fitgrowx-platform", normalized, message, { route: "onboarding/test-wa", timeout: 10_000 });
  if (!ok.ok) return NextResponse.json({ ok: false, error: "No se pudo enviar. Verificá que el número esté en WhatsApp." }, { status: 502 });

  const admin = getSupabaseAdminClient();
  await admin
    .from("platform_accounts")
    .update({ wa_test_sent_at: new Date().toISOString() })
    .eq("auth_user_id", user.id);

  return NextResponse.json({ ok: true });
}
