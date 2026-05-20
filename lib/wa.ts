import { logger } from "./logger";

const MOTOR_URL = () => process.env.WA_MOTOR_URL ?? "";
const API_KEY   = () => process.env.WA_MOTOR_API_KEY ?? "";

/**
 * Send a WhatsApp message via wa-server with retry logic.
 * Logs errors to platform_logs. Returns true on success.
 * Measures latency and captures motor status for metrics.
 */
export async function sendWa(
  session: string,
  phone:   string,
  message: string,
  opts?: { route?: string; timeout?: number; retries?: number },
): Promise<{ ok: boolean; latencyMs?: number; statusCode?: number; blocked?: boolean; attempts?: number }> {
  const motorUrl = MOTOR_URL();
  if (!motorUrl) {
    void logger.warn("WA_MOTOR_URL not configured", { route: opts?.route ?? "wa" });
    return { ok: false };
  }

  const maxRetries = opts?.retries ?? 3;
  const timeout = opts?.timeout ?? 10000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const res = await fetch(`${motorUrl}/send/${session}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY() },
        body:    JSON.stringify({ phone, message }),
        signal:  AbortSignal.timeout(timeout),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const blocked = res.status === 403;

        if (res.status === 503 && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 500));
          continue;
        }

        void logger.error(`WA send failed [${res.status}]`, {
          route: opts?.route ?? "wa",
          meta:  { session, phone: phone.slice(-4), status: res.status, latency: latencyMs, attempt, attempts: maxRetries, body: body.slice(0, 200) },
        });
        return { ok: false, latencyMs, statusCode: res.status, blocked, attempts: attempt };
      }

      return { ok: true, latencyMs, statusCode: res.status, attempts: attempt };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err instanceof DOMException && err.name === "AbortError";

      if ((isTimeout || String(err).includes("timeout")) && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt - 1) * 500));
        continue;
      }

      void logger.error(`WA send error: ${String(err)}`, {
        route: opts?.route ?? "wa",
        meta:  { session, phone: phone.slice(-4), latency: latencyMs, attempt, attempts: maxRetries },
      });
      return { ok: false, latencyMs, attempts: attempt };
    }
  }

  return { ok: false, attempts: maxRetries };
}

/** Check if a wa-server session is connected. */
export async function isWaConnected(session: string): Promise<boolean> {
  const motorUrl = MOTOR_URL();
  if (!motorUrl) return false;
  try {
    const res = await fetch(`${motorUrl}/session-status/${session}`, {
      headers: { "x-api-key": API_KEY() },
      signal:  AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "CONNECTED";
  } catch {
    return false;
  }
}
