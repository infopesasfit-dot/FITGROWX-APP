import { getSupabaseAdminClient } from "./supabase-admin";
import { sanitizeAuditState } from "./platform-audit";

type Level = "INFO" | "WARN" | "ERROR";

let lastAlert = 0;
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

async function writeLog(
  level: Level,
  message: string,
  route?: string,
  meta?: Record<string, unknown>,
  duration_ms?: number,
) {
  // Redact sensitive fields before persisting/transmitting (same policy as platform-audit)
  const safeMeta = meta ? (sanitizeAuditState(meta) as Record<string, unknown>) : meta;
  const entry = { level, message, route, duration_ms, meta: safeMeta, ts: new Date().toISOString() };

  if (level === "ERROR") console.error(JSON.stringify(entry));
  else if (level === "WARN") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));

  try {
    const sb = getSupabaseAdminClient();
    await sb.from("platform_logs").insert({ level, message, route, meta: safeMeta, duration_ms });

    if (level === "ERROR") {
      maybeAlert(message, route, safeMeta);
    }
  } catch {
    // Logger jamás puede romper el request principal
  }
}

async function maybeAlert(
  message: string,
  route?: string,
  meta?: Record<string, unknown>,
) {
  const now = Date.now();
  if (now - lastAlert < ALERT_COOLDOWN_MS) return;

  const sb = getSupabaseAdminClient();
  const since = new Date(now - 5 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("platform_logs")
    .select("*", { count: "exact", head: true })
    .eq("level", "ERROR")
    .gte("created_at", since);

  const errorCount = count ?? 0;
  if (errorCount < 3) return; // umbral: 3+ errores en 5 min

  lastAlert = now;

  const alertText =
    `🚨 FitGrowX Alerta\n` +
    `${errorCount} errores en los últimos 5 min\n` +
    `Mensaje: ${message}\n` +
    `Route: ${route ?? "—"}` +
    (meta ? `\nDetalle: ${JSON.stringify(meta)}` : "");

  await Promise.allSettled([
    sendWhatsAppAlert(alertText),
    sendEmailAlert(alertText, message, errorCount),
  ]);
}

async function sendWhatsAppAlert(text: string) {
  const waMotorUrl = process.env.WA_MOTOR_URL;
  const waApiKey = process.env.WA_MOTOR_API_KEY;
  const ownerPhone = process.env.ALERT_PHONE; // ej: "5491112345678"
  if (!waMotorUrl || !waApiKey || !ownerPhone) return;

  await fetch(`${waMotorUrl}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": waApiKey,
    },
    body: JSON.stringify({ to: ownerPhone, message: text }),
    signal: AbortSignal.timeout(5000),
  });
}

async function sendEmailAlert(text: string, subject: string, errorCount: number) {
  const resendKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL ?? "elianafrancoanahi@gmail.com";
  if (!resendKey) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "FitGrowX Radar <radar@fitgrowx.com>",
      to: [alertEmail],
      subject: `🚨 FitGrowX: ${errorCount} errores — ${subject.slice(0, 60)}`,
      text,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

export const logger = {
  info: (message: string, opts?: { route?: string; meta?: Record<string, unknown>; duration_ms?: number }) =>
    writeLog("INFO", message, opts?.route, opts?.meta, opts?.duration_ms),
  warn: (message: string, opts?: { route?: string; meta?: Record<string, unknown>; duration_ms?: number }) =>
    writeLog("WARN", message, opts?.route, opts?.meta, opts?.duration_ms),
  error: (message: string, opts?: { route?: string; meta?: Record<string, unknown>; duration_ms?: number }) =>
    writeLog("ERROR", message, opts?.route, opts?.meta, opts?.duration_ms),
};
