import { NextRequest, NextResponse } from "next/server";
import { assertPlatformOwner } from "@/lib/auth-platform";
import { applyRateLimit } from "@/lib/request-security";

const WIPE_TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  // ── 1. Authenticate as platform owner ───────────────────────────────────────
  const user = await assertPlatformOwner();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // ── 2. Validate X-Confirm-Wipe header ───────────────────────────────────────
  const confirmHeader = req.headers.get("X-Confirm-Wipe");
  if (confirmHeader !== "true") {
    return NextResponse.json(
      { error: "Confirmación requerida. Enviá el header X-Confirm-Wipe: true" },
      { status: 400 }
    );
  }

  // ── 3. Get and validate gymId from body ─────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const { gymId } = body as { gymId?: unknown };

  if (!gymId || typeof gymId !== "string" || gymId.trim() === "") {
    return NextResponse.json(
      { error: "gym_id inválido o vacío" },
      { status: 400 }
    );
  }

  // ── 4. Apply rate limit (destructive op: 2 per minute) ──────────────────────
  const rl = await applyRateLimit({
    namespace: "wa_wipe",
    identifier: user.id,
    windowMs: 60_000,
    maxAttempts: 2,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido. Reintentá más tarde." },
      { status: 429 }
    );
  }

  // ── 5. Call motor wipe endpoint ─────────────────────────────────────────────
  const motorUrl = process.env.WA_MOTOR_URL;
  const motorKey = process.env.WA_MOTOR_API_KEY;

  if (!motorUrl || !motorKey) {
    console.error("[WA Wipe] Motor no configurado");
    return NextResponse.json({ error: "Motor no disponible" }, { status: 500 });
  }

  try {
    const res = await fetch(`${motorUrl}/wipe/${gymId}`, {
      method: "POST",
      headers: { "x-api-key": motorKey },
      signal: AbortSignal.timeout(WIPE_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`[WA Wipe] Motor error HTTP ${res.status} — gym_id=${gymId}`);
      // Sanitized error — no exponemos body interno
      return NextResponse.json(
        { error: "Motor error" },
        { status: res.status }
      );
    }

    const data = await res.json() as Record<string, unknown>;
    console.log(`[WA Wipe] ✅ Credenciales wipadas — gym_id=${gymId} — user=${user.email}`);
    return NextResponse.json({ ok: true, message: data.message });
  } catch (error) {
    console.error(`[WA Wipe] Error — gym_id=${gymId}:`, error instanceof Error ? error.message : error);
    // Sanitized error — no exponemos detalles internos
    return NextResponse.json(
      { error: "Error al wipear credenciales" },
      { status: 502 }
    );
  }
}
