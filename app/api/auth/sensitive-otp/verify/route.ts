import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const sb = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  const { data: profile } = await sb
    .from("profiles")
    .select("otp_code, otp_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.otp_code || !profile?.otp_expires_at)
    return NextResponse.json({ error: "No hay un código activo. Solicitá uno nuevo." }, { status: 400 });

  if (new Date(profile.otp_expires_at) < new Date())
    return NextResponse.json({ error: "El código venció. Solicitá uno nuevo." }, { status: 400 });

  if (profile.otp_code !== code.trim())
    return NextResponse.json({ error: "Código incorrecto." }, { status: 400 });

  // Invalidate after use
  await sb.from("profiles").update({ otp_code: null, otp_expires_at: null }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
