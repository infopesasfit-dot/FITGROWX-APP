import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await applyRateLimit({
    namespace: "auth:resend",
    identifier: normalizeIdentifier(ip),
    windowMs: 60 * 60 * 1000,
    maxAttempts: 3,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en una hora." },
      { status: 429 },
    );
  }

  const { email } = (await req.json()) as { email?: string };
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email requerido." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resend({ type: "signup", email: email.trim() });

  return NextResponse.json({ ok: true });
}
