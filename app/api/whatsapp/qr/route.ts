import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";

const QR_TIMEOUT_MS = 13_000;

export async function GET(req: NextRequest) {
  // ── 1. Authenticate user ────────────────────────────────────────────────────
  const supabaseServer = await createSupabaseServerClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // ── 2. Get user's gym_id and verify role (owner/admin) ─────────────────────
  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // ── 3. Apply rate limit ─────────────────────────────────────────────────────
  const rl = await applyRateLimit({
    namespace: "wa_qr",
    identifier: `${user.id}:${gymId}`,
    windowMs: 60_000,
    maxAttempts: 10,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido. Reintentá más tarde." },
      { status: 429 }
    );
  }

  // ── 1. Pull directly from Railway WA motor ───────────────────────────────
  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error("[WA-QR] WA_MOTOR_URL no está configurado en las variables de entorno");
    return NextResponse.json({ error: "Servicio no disponible." }, { status: 500 });
  }

  const headers: Record<string, string> = {};
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  const endpoint = `${baseUrl}/qr/${gymId}/data`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), QR_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(endpoint, { headers, cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = ctrl.signal.aborted;
    const cause     = err instanceof Error ? err.message : String(err);

    console.error(
      `[WA-QR] ❌ Fetch al motor falló — gym_id=${gymId}`,
      `\n  tipo=${isTimeout ? `TIMEOUT >${QR_TIMEOUT_MS}ms` : "NETWORK_ERROR"}`,
      `\n  endpoint=${endpoint}`,
      `\n  causa=${cause}`,
      `\n  timestamp=${new Date().toISOString()}`,
    );

    return NextResponse.json(
      {
        error: "Servicio temporalmente no disponible.",
      },
      { status: 504 },
    );
  }

  // ── 2. Motor respondió pero con error HTTP ───────────────────────────────
  if (!res.ok) {
    let errorBody: string;
    try {
      errorBody = await res.text();
    } catch {
      errorBody = "(no se pudo leer el cuerpo de respuesta)";
    }

    console.error(
      `[WA-QR] ❌ Motor devolvió error — gym_id=${gymId}`,
      `\n  HTTP=${res.status} ${res.statusText}`,
      `\n  endpoint=${endpoint}`,
      `\n  body="${errorBody}"`,
      `\n  timestamp=${new Date().toISOString()}`,
    );

    return NextResponse.json(
      {
        error: "Servicio no disponible.",
      },
      { status: res.status },
    );
  }

  // ── 3. Respuesta exitosa — normalizar ────────────────────────────────────
  const contentType = res.headers.get("content-type") ?? "";

  // Raw image response → convert to base64
  if (contentType.startsWith("image/")) {
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    console.log(`[WA-QR] ✅ QR imagen recibido como ${contentType} — gym_id=${gymId}`);
    return NextResponse.json({ image: `data:${contentType};base64,${base64}` });
  }

  // JSON response (e.g. { qr: "data:image/png;base64,..." } or { image: "..." })
  let data: Record<string, unknown>;
  try {
    data = await res.json() as Record<string, unknown>;
  } catch (parseErr) {
    console.error(
      `[WA-QR] ❌ Respuesta OK pero el JSON es inválido — gym_id=${gymId}`,
      `\n  content-type=${contentType}`,
      `\n  parseError=${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    );
    return NextResponse.json({ error: "Servicio no disponible." }, { status: 502 });
  }

  const image = (data.image ?? data.qr ?? data.data) as string | undefined;
  if (!image) {
    // Motor todavía conectando — no es un error, el frontend reintentará
    const status = (data.status as string) ?? "connecting";
    if (status === "active") return NextResponse.json({ status: "active" });
    return NextResponse.json({ status });
  }

  console.log(`[WA-QR] ✅ QR JSON recibido — gym_id=${gymId}`);
  return NextResponse.json({ image });
}
