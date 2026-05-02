import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, gym_name, type } = await req.json();
    if (!email && !phone) return NextResponse.json({ error: "Email o teléfono requerido." }, { status: 400 });

    const source = type === "whitelabel" ? "upsell_whitelabel" : "upsell_landing_pro";
    const normalizedEmail = (email ?? "").trim().toLowerCase() || null;
    const now = new Date().toISOString();

    const { data: existing } = normalizedEmail
      ? await supabase.from("platform_leads").select("id").eq("email", normalizedEmail).maybeSingle()
      : { data: null };

    if (existing?.id) {
      await supabase.from("platform_leads").update({
        full_name: name || null,
        business_name: gym_name || null,
        phone: phone || null,
        source,
        last_contact_at: now,
      }).eq("id", existing.id);
    } else {
      await supabase.from("platform_leads").insert({
        full_name: name || null,
        business_name: gym_name || null,
        email: normalizedEmail,
        phone: phone || null,
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
