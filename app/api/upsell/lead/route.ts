import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp } from "@/lib/request-security";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const limit = await applyRateLimit({ namespace: "upsell:lead", identifier: getClientIp(req), windowMs: 60_000, maxAttempts: 5 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiados intentos. Esperá un momento." }, { status: 429 });

  try {
    const raw = await req.json();
    const name      = raw.name?.trim()     || null;
    const gym_name  = raw.gym_name?.trim() || null;
    const phone     = raw.phone?.trim()    || null;
    const type      = raw.type;
    const email     = raw.email;
    if (!email && !phone) return NextResponse.json({ error: "Email o teléfono requerido." }, { status: 400 });

    const source = type === "whitelabel" ? "upsell_whitelabel" : "upsell_landing_pro";
    const normalizedEmail = (email ?? "").trim().toLowerCase() || null;
    const now = new Date().toISOString();

    const { data: existing } = normalizedEmail
      ? await supabase.from("platform_leads").select("id").eq("email", normalizedEmail).maybeSingle()
      : { data: null };

    if (existing?.id) {
      await supabase.from("platform_leads").update({
        full_name: name,
        business_name: gym_name,
        phone,
        source,
        last_contact_at: now,
      }).eq("id", existing.id);
    } else {
      await supabase.from("platform_leads").insert({
        full_name: name,
        business_name: gym_name,
        email: normalizedEmail,
        phone,
        source,
        status: "new",
        last_contact_at: now,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error." }, { status: 500 });
  }
}
