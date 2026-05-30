import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";
import { requireGymNotBlocked } from "@/lib/require-gym-not-blocked";

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
        console.log(`[WA-RESTART] ${tag} Motor reiniciado — método OK`);
        return { ok: true };
      }
      console.warn(`[WA-RESTART] ${tag} Intento falló (HTTP ${res.status}) — probando siguiente…`);
    } catch (err) {
      console.warn(`[WA-RESTART] ${tag} Intento falló:`, err instanceof Error ? err.message : err);
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
      return { ok: true };
    } catch (err) {
      console.error(`[WA-RESTART] ${tag} Fallback de borrado de sesión también falló:`, err instanceof Error ? err.message : err);
    }
  }

  console.error(`[WA-RESTART] ${tag} TODOS los intentos de reinicio fallaron. Motor posiblemente caído.`);
  return { ok: false };
}

/** POST /api/whatsapp/restart
 *  Fuerza reinicio total del motor de WhatsApp. Llamado por el frontend
 *  como "tiro de gracia" luego de 3 reintentos fallidos. */
export async function POST(req: NextRequest) {
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

  const blocked = await requireGymNotBlocked(gymId);
  if (blocked) return blocked;

  // ── 3. Apply rate limit (destructive op: 3 attempts per minute) ─────────────
  const rl = await applyRateLimit({
    namespace: "wa_restart",
    identifier: `${user.id}:${gymId}`,
    windowMs: 60_000,
    maxAttempts: 3,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido. Reintentá más tarde." },
      { status: 429 }
    );
  }

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error("[WA-RESTART] WA_MOTOR_URL no configurado — imposible reiniciar motor");
    return NextResponse.json({ ok: false, reason: "Motor no disponible" }, { status: 500 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  console.log(`[WA-RESTART] Solicitud de reinicio recibida — gym_id=${gymId} — timestamp=${new Date().toISOString()}`);

  const result = await triggerMotorRestart(baseUrl, headers, gymId);

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
