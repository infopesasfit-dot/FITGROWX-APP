import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const sb = getSupabaseAdminClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { name, phone } = await req.json();

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Nombre y teléfono requeridos" }, { status: 400 });
  }

  const { data: pass } = await sb
    .from("guest_passes")
    .select("id, gym_id, alumno_id, code, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pass) return NextResponse.json({ error: "Pase inválido" }, { status: 404 });
  if (pass.status !== "pending") return NextResponse.json({ error: "Pase ya utilizado" }, { status: 409 });
  if (new Date(pass.expires_at) < new Date()) return NextResponse.json({ error: "Pase vencido" }, { status: 410 });

  const now = new Date().toISOString();
  await sb.from("guest_passes").update({
    status:     "claimed",
    lead_name:  name.trim(),
    lead_phone: phone.trim(),
    claimed_at: now,
  }).eq("id", pass.id);

  // Fetch alumno name + gym settings for WA messages
  const [{ data: alumno }, { data: settings }] = await Promise.all([
    sb.from("alumnos").select("full_name").eq("id", pass.alumno_id).maybeSingle(),
    sb.from("gym_settings").select("gym_name, whatsapp").eq("gym_id", pass.gym_id).maybeSingle(),
  ]);

  const gymName    = settings?.gym_name ?? "el gym";
  const alumnoName = (alumno?.full_name ?? "").split(" ")[0] || "tu amigo";
  const expDate    = new Date(pass.expires_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  const motorUrl   = process.env.WA_MOTOR_URL;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";

  if (motorUrl) {
    const passUrl = `${appUrl}/pase/${token}`;

    // WA to the lead (friend)
    const normalizedPhone = phone.trim().replace(/\D/g, "");
    fetch(`${motorUrl}/send/${pass.gym_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
      body: JSON.stringify({
        phone: normalizedPhone,
        message:
          `🏋️ *¡Hola ${name.trim().split(" ")[0]}! Tu pase libre para ${gymName} está listo.*\n\n` +
          `📋 Código: *${pass.code}*\n` +
          `📅 Válido hasta el ${expDate}\n\n` +
          `Mostrá este código al staff cuando llegues:\n${passUrl}\n\n` +
          `_Invitado por ${alumnoName}_ 💪`,
      }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});

    // WA to gym owner (lead notification)
    if (settings?.whatsapp) {
      const ownerPhone = settings.whatsapp.replace(/\D/g, "");
      fetch(`${motorUrl}/send/${pass.gym_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
        body: JSON.stringify({
          phone: ownerPhone,
          message:
            `🎯 *Nuevo lead — Pase Libre*\n\n` +
            `👤 Nombre: ${name.trim()}\n` +
            `📱 Teléfono: ${normalizedPhone}\n` +
            `🤝 Invitado por: ${alumno?.full_name ?? alumnoName}\n` +
            `📅 Válido hasta: ${expDate}\n\n` +
            `Ver en dashboard: ${appUrl}/dashboard/alumnos`,
        }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ code: pass.code, expiresAt: pass.expires_at, gymName });
}
