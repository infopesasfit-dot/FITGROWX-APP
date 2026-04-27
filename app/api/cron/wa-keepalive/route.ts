import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MOTOR_TIMEOUT_MS = 8_000;

async function motorGet(url: string, headers: Record<string, string>): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), MOTOR_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch {
    clearTimeout(t);
    return null;
  }
}

async function motorPost(url: string, headers: Record<string, string>, body?: unknown): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), MOTOR_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res;
  } catch {
    clearTimeout(t);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.WA_MOTOR_API_KEY) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const motorUrl = process.env.WA_MOTOR_URL;
  if (!motorUrl) return NextResponse.json({ error: "WA_MOTOR_URL no configurado." }, { status: 500 });

  const headers: Record<string, string> = {};
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  const log: string[] = [];

  // Gyms que Supabase cree que están activos
  const { data: gyms } = await supabase
    .from("gym_settings")
    .select("gym_id, wa_status, wa_phone")
    .in("wa_status", ["active", "qr"]);

  if (!gyms?.length) return NextResponse.json({ ok: true, log: ["No hay gyms con sesión activa."] });

  for (const gym of gyms) {
    const gymId = gym.gym_id;

    // ── 1. Verificar estado real en el motor ────────────────────────────────
    const statusRes = await motorGet(`${motorUrl}/session-status/${gymId}`, headers);

    let realStatus: string | null = null;
    if (statusRes?.ok) {
      const raw = await statusRes.json().catch(() => ({})) as Record<string, unknown>;
      const s = String(raw.status ?? "").toLowerCase();
      realStatus =
        s === "active"  || s === "working"      ? "active" :
        s === "qr"      || s === "scan_qr_code" ? "qr" :
        "disconnected";
    }

    // Motor no responde → sesión probablemente perdida por redeploy
    if (!statusRes || !statusRes.ok || realStatus === "disconnected") {
      log.push(`[${gymId}] Motor responde: ${realStatus ?? "sin respuesta"} — intentando restaurar sesión…`);

      // ── 2. Intentar restaurar desde creds_json guardado ─────────────────
      const { data: sessionRow } = await supabase
        .from("whatsapp_sessions")
        .select("creds_json")
        .eq("gym_id", gymId)
        .maybeSingle();

      let restored = false;

      if (sessionRow?.creds_json) {
        // El motor puede exponer /session/{id}/restore o /session/{id}/init con credenciales
        const restoreEndpoints = [
          `${motorUrl}/session/${gymId}/restore`,
          `${motorUrl}/session/${gymId}/init`,
        ];

        for (const endpoint of restoreEndpoints) {
          const res = await motorPost(endpoint, headers, { creds_json: sessionRow.creds_json });
          if (res && (res.ok || res.status === 409)) {
            log.push(`[${gymId}] Sesión restaurada vía ${endpoint} → HTTP ${res.status}`);
            restored = true;
            break;
          }
        }
      } else {
        log.push(`[${gymId}] Sin creds_json guardado — no se puede restaurar automáticamente`);
      }

      if (!restored) {
        // No se pudo restaurar → marcar como desconectado en Supabase
        // El dashboard mostrará el banner "reconectar" la próxima vez que el gym abra automatizaciones
        await supabase
          .from("gym_settings")
          .update({ wa_status: "disconnected", wa_phone: null, wa_battery: null, wa_plugged: null, wa_signal: null })
          .eq("gym_id", gymId);
        log.push(`[${gymId}] ❌ Restauración fallida — wa_status → disconnected`);
      }

      continue;
    }

    // ── 3. Sesión sigue activa — sincronizar estado si hubo desfase ─────────
    if (realStatus === "active" && gym.wa_status !== "active") {
      await supabase.from("gym_settings").update({ wa_status: "active" }).eq("gym_id", gymId);
    }

    log.push(`[${gymId}] ✓ ${realStatus}`);
  }

  return NextResponse.json({ ok: true, checked: gyms.length, log });
}
