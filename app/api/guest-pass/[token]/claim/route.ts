import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendWa } from "@/lib/wa";
import { normalizePhone } from "@/lib/phone";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { verifyTurnstileToken } from "@/lib/turnstile";

const sb = getSupabaseAdminClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const ip = getClientIp(req);
  const rl = await applyRateLimit({
    namespace: "guest-pass-claim",
    identifier: `${normalizeIdentifier(ip)}::${token}`,
    windowMs: 60 * 60 * 1000,
    maxAttempts: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Esperá un momento." },
      { status: 429 }
    );
  }

  const { name, phone, turnstileToken } = await req.json();

  const ts = await verifyTurnstileToken(req, turnstileToken);
  if (!ts.ok) return NextResponse.json({ error: ts.error }, { status: ts.status });

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Nombre y teléfono requeridos" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone || "");
  if (!/^549\d{10}$/.test(normalizedPhone)) {
    return NextResponse.json(
      { error: "Número de teléfono inválido. Usá formato argentino." },
      { status: 400 }
    );
  }

  const { data: pass } = await sb
    .from("guest_passes")
    .select("id, gym_id, alumno_id, code, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pass) return NextResponse.json({ error: "Pase inválido" }, { status: 404 });
  if (pass.status !== "pending") return NextResponse.json({ error: "Pase ya utilizado" }, { status: 409 });
  if (new Date(pass.expires_at) < new Date()) return NextResponse.json({ error: "Pase vencido" }, { status: 410 });

  // Fetch alumno name + gym settings for WA messages
  const [{ data: alumno }, { data: settings }] = await Promise.all([
    sb.from("alumnos").select("full_name").eq("id", pass.alumno_id).eq("is_demo", false).maybeSingle(),
    sb.from("gym_settings").select("gym_name, whatsapp").eq("gym_id", pass.gym_id).maybeSingle(),
  ]);
  if (!alumno) return NextResponse.json({ error: "Pase inválido" }, { status: 404 });

  const now = new Date().toISOString();
  await sb.from("guest_passes").update({
    status:     "claimed",
    lead_name:  name.trim(),
    lead_phone: phone.trim(),
    claimed_at: now,
  }).eq("id", pass.id);

  const gymName    = settings?.gym_name ?? "el gym";
  const alumnoName = (alumno?.full_name ?? "").split(" ")[0] || "tu amigo";
  const expDate    = new Date(pass.expires_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";
  const passUrl = `${appUrl}/pase/${token}`;

  void sendWa(
    pass.gym_id,
    normalizedPhone,
    `🏋️ *¡Hola ${name.trim().split(" ")[0]}! Tu pase libre para ${gymName} está listo.*\n\n` +
    `📋 Código: *${pass.code}*\n` +
    `📅 Válido hasta el ${expDate}\n\n` +
    `Mostrá este código al staff cuando llegues:\n${passUrl}\n\n` +
    `_Invitado por ${alumnoName}_ 💪`,
    { route: "guest-pass/claim" },
  );

  if (settings?.whatsapp) {
    void sendWa(
      pass.gym_id,
      settings.whatsapp.replace(/\D/g, ""),
      `🎯 *Nuevo lead — Pase Libre*\n\n` +
      `👤 Nombre: ${name.trim()}\n` +
      `📱 Teléfono: ${normalizedPhone}\n` +
      `🤝 Invitado por: ${alumno?.full_name ?? alumnoName}\n` +
      `📅 Válido hasta: ${expDate}\n\n` +
      `Ver en dashboard: ${appUrl}/dashboard/alumnos`,
      { route: "guest-pass/claim" },
    );
  }

  return NextResponse.json({ code: pass.code, expiresAt: pass.expires_at, gymName });
}
