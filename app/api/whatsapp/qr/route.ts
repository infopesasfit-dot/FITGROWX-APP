import { NextRequest, NextResponse } from "next/server";

const QR_TIMEOUT_MS = 13_000;

export async function GET(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");
  if (!gymId) return NextResponse.json({ error: "gym_id requerido" }, { status: 400 });

  // ── 1. Pull directly from Railway WA motor ───────────────────────────────
  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error("[WA-QR] WA_MOTOR_URL no está configurado en las variables de entorno");
    return NextResponse.json({ error: "WA_MOTOR_URL not configured" }, { status: 500 });
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
        error: isTimeout
          ? `Motor no respondió en ${QR_TIMEOUT_MS / 1000}s`
          : `Error de red al contactar el motor: ${cause}`,
        debug: { endpoint, isTimeout, cause },
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
        error: `Motor respondió HTTP ${res.status}`,
        debug: { httpStatus: res.status, httpStatusText: res.statusText, body: errorBody },
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
    return NextResponse.json({ error: "El motor devolvió JSON inválido" }, { status: 502 });
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
