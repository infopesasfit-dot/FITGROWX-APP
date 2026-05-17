import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizePhone } from "@/lib/phone";
import { sendWa } from "@/lib/wa";

const sb = getSupabaseAdminClient();

export async function POST() {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await sb
    .from("profiles")
    .select("phone, gym_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.phone)
    return NextResponse.json({ error: "No tenés un número de WhatsApp configurado. Agregalo en Ajustes → General." }, { status: 400 });

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  await sb.from("profiles").update({ otp_code: code, otp_expires_at: expiresAt }).eq("id", user.id);

  const gymId = profile.gym_id;
  const phone = normalizePhone(profile.phone);
  const msg = `🔐 *FitGrowX — Código de confirmación*\n\nTu código es: *${code}*\n\nVence en 10 minutos. No lo compartas con nadie.`;

  const ok = await sendWa(gymId, phone, msg, { route: "auth/sensitive-otp" });
  if (!ok) return NextResponse.json({ error: "No se pudo enviar el código. Verificá que WhatsApp esté conectado." }, { status: 500 });

  const masked = profile.phone.slice(-4).padStart(profile.phone.length, "•");
  return NextResponse.json({ ok: true, masked });
}
