import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Proxy server-side para el motor WA — la URL de Railway nunca sale al cliente

const ALLOWED_PATHS = new Set([
  "session-status",
  "qr-data",
  "session-delete",
  "session-reconnect",
  "send-message",
]);

const PLATFORM_SESSION_ID = "fitgrowx-platform";

export async function POST(req: NextRequest) {
  const motor = process.env.WA_MOTOR_URL;
  if (!motor) return NextResponse.json({ error: "Motor no configurado" }, { status: 503 });

  // Verificar sesión activa
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { action, gymId, phone, message } = await req.json();
  if (!action || !gymId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!ALLOWED_PATHS.has(action)) return NextResponse.json({ error: "Acción no permitida" }, { status: 400 });

  // Para la sesión de plataforma, verificar que el usuario es platform_owner
  if (gymId === PLATFORM_SESSION_ID) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "platform_owner") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (user.id !== gymId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": process.env.WA_MOTOR_API_KEY ?? "",
  };

  try {
    let res: Response;
    switch (action) {
      case "session-status":
        res = await fetch(`${motor}/session-status/${gymId}`, { headers, signal: AbortSignal.timeout(8000) });
        break;
      case "qr-data":
        res = await fetch(`${motor}/qr/${gymId}/data`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
        break;
      case "session-delete":
        res = await fetch(`${motor}/session/${gymId}`, { method: "DELETE", headers, signal: AbortSignal.timeout(8000) });
        break;
      case "session-reconnect":
        res = await fetch(`${motor}/session/${gymId}/reconnect`, { method: "POST", headers, signal: AbortSignal.timeout(8000) });
        break;
      case "send-message":
        if (!phone || !message) return NextResponse.json({ error: "Faltan phone y message" }, { status: 400 });
        res = await fetch(`${motor}/send/${gymId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone, message }),
          signal: AbortSignal.timeout(12000),
        });
        break;
      default:
        return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[wa/proxy] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error conectando con el motor WA" }, { status: 502 });
  }
}
