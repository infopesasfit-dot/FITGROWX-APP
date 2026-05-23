import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createHash } from "crypto";
import { applyRateLimit } from "@/lib/request-security";

const sb = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const sbUser = await createSupabaseServerClient();
  const { data: { user } } = await sbUser.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await applyRateLimit({
    namespace: "otp-verify",
    identifier: user.id,
    windowMs: 60 * 1000,
    maxAttempts: 5,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Intentá en un momento." }, { status: 429 });
  }

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Código requerido" }, { status: 400 });

  const { data: profile } = await sb
    .from("profiles")
    .select("otp_code, otp_expires_at, otp_failed_attempts")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.otp_code || !profile?.otp_expires_at)
    return NextResponse.json({ error: "No hay un código activo. Solicitá uno nuevo." }, { status: 400 });

  if (new Date(profile.otp_expires_at) < new Date())
    return NextResponse.json({ error: "El código venció. Solicitá uno nuevo." }, { status: 400 });

  const codeHash = createHash("sha256").update(code.trim()).digest("hex");
  if (profile.otp_code !== codeHash) {
    const newAttempts = (profile.otp_failed_attempts ?? 0) + 1;
    if (newAttempts >= 5) {
      await sb
        .from("profiles")
        .update({ otp_code: null, otp_expires_at: null, otp_failed_attempts: 0 })
        .eq("id", user.id);
      return NextResponse.json({ error: "Código incorrecto. Demasiados intentos fallidos. Solicitá uno nuevo." }, { status: 400 });
    }
    await sb.from("profiles").update({ otp_failed_attempts: newAttempts }).eq("id", user.id);
    return NextResponse.json({ error: "Código incorrecto." }, { status: 400 });
  }

  // Invalidate after use
  await sb
    .from("profiles")
    .update({ otp_code: null, otp_expires_at: null, otp_failed_attempts: 0 })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
