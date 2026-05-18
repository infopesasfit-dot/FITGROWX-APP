import { logger } from "./logger";

const MOTOR_URL = () => process.env.WA_MOTOR_URL ?? "";
const API_KEY   = () => process.env.WA_MOTOR_API_KEY ?? "";

/**
 * Send a WhatsApp message via wa-server.
 * Logs errors to platform_logs. Returns true on success.
 */
export async function sendWa(
  session: string,
  phone:   string,
  message: string,
  opts?: { route?: string; timeout?: number },
): Promise<boolean> {
  const motorUrl = MOTOR_URL();
  if (!motorUrl) {
    void logger.warn("WA_MOTOR_URL not configured", { route: opts?.route ?? "wa" });
    return false;
  }

  try {
    const res = await fetch(`${motorUrl}/send/${session}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY() },
      body:    JSON.stringify({ phone, message }),
      signal:  AbortSignal.timeout(opts?.timeout ?? 3000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      void logger.error(`WA send failed [${res.status}]`, {
        route: opts?.route ?? "wa",
        meta:  { session, phone: phone.slice(-4), status: res.status, body: body.slice(0, 200) },
      });
      return false;
    }

    return true;
  } catch (err) {
    void logger.error(`WA send error: ${String(err)}`, {
      route: opts?.route ?? "wa",
      meta:  { session, phone: phone.slice(-4) },
    });
    return false;
  }
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
