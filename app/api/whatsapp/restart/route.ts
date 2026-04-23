import { NextRequest, NextResponse } from "next/server";

const HEALTH_TIMEOUT_MS = 10_000;

async function triggerMotorRestart(baseUrl: string, headers: Record<string, string>, gymId?: string | null) {
  const tag = gymId ? `[gym:${gymId}]` : "[global]";

  // 1. Try dedicated restart/reload endpoint (common in waha / custom motors)
  const restartTargets = gymId
    ? [`${baseUrl}/session/${gymId}/restart`, `${baseUrl}/restart/${gymId}`]
    : [`${baseUrl}/restart`, `${baseUrl}/reload`];

  for (const url of restartTargets) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
      const res = await fetch(url, { method: "POST", headers, signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) {
        console.log(`[WA-RESTART] ${tag} Motor reiniciado vía ${url} → ${res.status}`);
        return { ok: true, method: "restart", url };
      }
      console.warn(`[WA-RESTART] ${tag} ${url} respondió ${res.status} — probando siguiente…`);
    } catch (err) {
      console.warn(`[WA-RESTART] ${tag} ${url} falló:`, err instanceof Error ? err.message : err);
    }
  }

  // 2. Fallback: delete session + re-init (hard reset)
  if (gymId) {
    try {
      console.log(`[WA-RESTART] ${tag} Fallback — borrando sesión para forzar re-init…`);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
      await fetch(`${baseUrl}/session/${gymId}`, { method: "DELETE", headers, signal: ctrl.signal });
      clearTimeout(t);
      console.log(`[WA-RESTART] ${tag} Sesión eliminada — el motor levantará una nueva sesión en el próximo QR scan`);
      return { ok: true, method: "session-delete" };
    } catch (err) {
      console.error(`[WA-RESTART] ${tag} Fallback de borrado de sesión también falló:`, err instanceof Error ? err.message : err);
    }
  }

  console.error(`[WA-RESTART] ${tag} TODOS los intentos de reinicio fallaron. Motor posiblemente caído.`);
  return { ok: false, reason: "all-restart-methods-failed" };
}

/** POST /api/whatsapp/restart?gym_id=...
 *  Fuerza reinicio total del motor de WhatsApp. Llamado por el frontend
 *  como "tiro de gracia" luego de 3 reintentos fallidos. */
export async function POST(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error("[WA-RESTART] WA_MOTOR_URL no configurado — imposible reiniciar motor");
    return NextResponse.json({ ok: false, reason: "WA_MOTOR_URL not configured" }, { status: 500 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  console.log(`[WA-RESTART] Solicitud de reinicio recibida — gym_id=${gymId ?? "N/A"} — timestamp=${new Date().toISOString()}`);

  const result = await triggerMotorRestart(baseUrl, headers, gymId);

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
