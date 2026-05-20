import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendWa } from "@/lib/wa";

const sb = getSupabaseAdminClient();

const COUNTRY_RULES: Record<string, { digits: number; pattern: RegExp }> = {
  AR: { digits: 11, pattern: /^9\d{10}$/ },
  UY: { digits: 9, pattern: /^(9\d{7}|[1-9]\d{7})$/ },
  CL: { digits: 9, pattern: /^9\d{8}$/ },
  CO: { digits: 10, pattern: /^3\d{9}$/ },
  MX: { digits: 10, pattern: /^[1-9]\d{9}$/ },
  PE: { digits: 9, pattern: /^9\d{8}$/ },
  EC: { digits: 9, pattern: /^[0-9]\d{8}$/ },
  BO: { digits: 8, pattern: /^[67]\d{7}$/ },
  PY: { digits: 9, pattern: /^9\d{8}$/ },
  BR: { digits: 10, pattern: /^[1-9]\d{8,9}$/ },
  VE: { digits: 10, pattern: /^[2-4]\d{9}$/ },
  CU: { digits: 8, pattern: /^5\d{7}$/ },
  DO: { digits: 10, pattern: /^(809|829|849)\d{7}$/ },
  CR: { digits: 8, pattern: /^[2-9]\d{7}$/ },
  PA: { digits: 8, pattern: /^[0-9]\d{7}$/ },
  ES: { digits: 9, pattern: /^[6-9]\d{8}$/ },
};

function validatePhoneByCountry(phone: string, country: string): boolean {
  const rule = COUNTRY_RULES[country];
  if (!rule) return false;
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;
  // Quitar código de país si está presente
  const countryCodes: Record<string, string> = {
    AR: "54", UY: "598", CL: "56", CO: "57", MX: "52", PE: "51", EC: "593",
    BO: "591", PY: "595", BR: "55", VE: "58", CU: "53", DO: "1809",
    CR: "506", PA: "507", ES: "34"
  };
  const cc = countryCodes[country];
  if (cc && normalized.startsWith(cc)) {
    normalized = normalized.slice(cc.length);
  }
  return rule.pattern.test(normalized);
}

export async function POST(req: NextRequest) {
  // 3 intentos por IP por hora
  if (!rateLimit(`reseller_apply:${getClientIp(req)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Demasiados intentos. Esperá un rato." }, { status: 429 });
  }

  const { name, email, whatsapp, colleague_count, social_links, motivation, country } = await req.json();

  if (!name?.trim() || !email?.trim() || !whatsapp?.trim()) {
    return NextResponse.json({ error: "Nombre, email y WhatsApp son requeridos" }, { status: 400 });
  }

  const countryCode = country || "AR";
  if (!validatePhoneByCountry(whatsapp, countryCode)) {
    return NextResponse.json({ error: `Teléfono inválido para ${countryCode}` }, { status: 400 });
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
    country:         countryCode,
  });

  // Notify admin
  const ownerPhone = process.env.OWNER_PHONE;
  if (ownerPhone) {
    void sendWa(
      "fitgrowx-platform",
      ownerPhone,
      `🤝 *Nueva postulación de reseller*\n\n` +
      `👤 ${name.trim()}\n` +
      `📱 ${whatsapp.trim()}\n` +
      `📧 ${email.trim()}\n` +
      `👥 Colegas: ${colleague_count ?? "—"}\n` +
      `📣 Redes: ${social_links?.trim() || "—"}\n\n` +
      `Ver en plataforma: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com"}/platform/resellers`,
      { route: "reseller/apply" },
    );
  }

  return NextResponse.json({ ok: true });
}
