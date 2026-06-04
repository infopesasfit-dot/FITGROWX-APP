import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await applyRateLimit({
    namespace: "auth:reset",
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

  const { email, redirectTo } = (await req.json()) as { email?: string; redirectTo?: string };
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email requerido." }, { status: 400 });
  }

  const allowed = ["https://fitgrowx.com", "http://localhost:3000"];
  if (redirectTo && !allowed.some((d) => redirectTo.startsWith(d))) {
    return NextResponse.json({ error: "redirectTo inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });

  if (error) {
    return NextResponse.json(
      { error: "Error al enviar el email. Intente nuevamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
