import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, getClientIp, normalizeIdentifier } from "@/lib/request-security";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await applyRateLimit({
    namespace: "auth:signin",
    identifier: normalizeIdentifier(ip),
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429 },
    );
  }

  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email y contraseña requeridos." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const friendly =
      msg.includes("invalid login credentials") || msg.includes("invalid credentials")
        ? "Usuario o contraseña incorrectos."
        : msg.includes("email not confirmed")
        ? "Confirmá tu email antes de ingresar."
        : "Error al iniciar sesión. Intente nuevamente.";
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "No se pudo obtener el usuario." }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .limit(1)
    .maybeSingle();

  const destination = profile?.role === "platform_owner" ? "/platform" : "/dashboard";

  return NextResponse.json({ destination });
}
