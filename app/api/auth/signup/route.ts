import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await applyRateLimit({
    namespace: "auth:signup",
    identifier: normalizeIdentifier(ip),
    windowMs: 60 * 60 * 1000,
    maxAttempts: 5,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en una hora." },
      { status: 429 },
    );
  }

  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });

  if (error) {
    console.error("[signup] Supabase error:", error.message, error.status, error.code);
    const msg = error.message.toLowerCase();
    const friendly =
      msg.includes("already registered") || msg.includes("already exists")
        ? "Este email ya está registrado."
        : "Error al registrarse. Intente nuevamente.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }

  if (!data.session) {
    return NextResponse.json({ needsVerification: true });
  }

  return NextResponse.json({
    needsVerification: false,
    accessToken: data.session.access_token,
  });
}
