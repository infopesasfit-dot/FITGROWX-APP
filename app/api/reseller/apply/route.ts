import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const sb = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  // 3 intentos por IP por hora
  if (!rateLimit(`reseller_apply:${getClientIp(req)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá un rato." }, { status: 429 });
  }

  const { name, email, whatsapp, colleague_count, social_links, motivation } = await req.json();

  if (!name?.trim() || !email?.trim() || !whatsapp?.trim()) {
    return NextResponse.json({ error: "Nombre, email y WhatsApp son requeridos" }, { status: 400 });
  }

  // Prevent duplicate applications
  const { data: existing } = await sb
    .from("reseller_applications")
    .select("id, status")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: existing.status === "approved"
        ? "Ya sos parte de la red. Revisá tu email."
        : "Ya recibimos tu postulación. Te contactamos pronto.",
    }, { status: 409 });
  }

  await sb.from("reseller_applications").insert({
    name:            name.trim(),
    email:           email.trim().toLowerCase(),
    whatsapp:        whatsapp.trim().replace(/\D/g, ""),
    colleague_count: colleague_count ?? null,
    social_links:    social_links?.trim() || null,
    motivation:      motivation?.trim() || null,
  });

  // Notify admin
  const motorUrl   = process.env.WA_MOTOR_URL;
  const ownerPhone = process.env.OWNER_PHONE;
  if (motorUrl && ownerPhone) {
    fetch(`${motorUrl}/send/fitgrowx-platform`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.WA_MOTOR_API_KEY ?? "" },
      body: JSON.stringify({
        phone: ownerPhone,
        message:
          `🤝 *Nueva postulación de reseller*\n\n` +
          `👤 ${name.trim()}\n` +
          `📱 ${whatsapp.trim()}\n` +
          `📧 ${email.trim()}\n` +
          `👥 Colegas: ${colleague_count ?? "—"}\n` +
          `📣 Redes: ${social_links?.trim() || "—"}\n\n` +
          `Ver en plataforma: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/platform/resellers`,
      }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
