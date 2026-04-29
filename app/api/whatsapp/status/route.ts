import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type AuthorizedProfile = {
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

export type WaStatusResponse = {
  status: "active" | "disconnected" | "qr" | "unknown";
  phone?:   string;
  battery?: number;
  plugged?: boolean;
  signal?:  number;
  autoRestarted?: boolean;
};

const HEALTH_TIMEOUT_MS = 10_000;

/** Si el motor no responde en 10 s, lo reiniciamos automáticamente y logueamos el incidente. */
async function healthCheckWithAutoRestart(
  baseUrl: string,
  headers: Record<string, string>,
  endpoint: string,
  gymId?: string | null,
): Promise<{ res: Response | null; autoRestarted: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    console.error(
      `[WA-HEALTH] ⚠️  Motor no respondió en ${HEALTH_TIMEOUT_MS / 1000}s — gym_id=${gymId ?? "N/A"} — endpoint=${endpoint}`,
      `\n  → Proceso colgado detectado. Disparando auto-restart…`,
      `\n  → timestamp=${new Date().toISOString()}`,
    );
    ctrl.abort();
  }, HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, { headers, cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    return { res, autoRestarted: false };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = ctrl.signal.aborted;

    console.error(
      `[WA-HEALTH] Motor DOWN — gym_id=${gymId ?? "N/A"}`,
      `\n  causa=${isTimeout ? "TIMEOUT >10s" : (err instanceof Error ? err.message : String(err))}`,
      `\n  endpoint=${endpoint}`,
      `\n  timestamp=${new Date().toISOString()}`,
    );

    // Auto-restart sin esperar al usuario
    try {
      const restartUrl = gymId
        ? `${baseUrl}/session/${gymId}/restart`
        : `${baseUrl}/restart`;
      const restartCtrl = new AbortController();
      const rt = setTimeout(() => restartCtrl.abort(), 5_000);
      const rRes = await fetch(restartUrl, { method: "POST", headers, signal: restartCtrl.signal });
      clearTimeout(rt);
      console.log(`[WA-HEALTH] Auto-restart ejecutado → ${restartUrl} → HTTP ${rRes.status}`);
    } catch (restartErr) {
      console.error(
        `[WA-HEALTH] Auto-restart también falló — motor completamente caído`,
        `\n  error=${restartErr instanceof Error ? restartErr.message : String(restartErr)}`,
      );
    }

    return { res: null, autoRestarted: true };
  }
}

export async function GET(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");
  const supabaseServer = await createSupabaseServerClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  if (!profile) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (gymId && profile.role !== "platform_owner" && profile.gym_id !== gymId) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // ── 1. State cached in Supabase (written by webhook) ─────────────────────
  if (gymId) {
    const { data } = await supabase
      .from("gym_settings")
      .select("wa_status, wa_phone, wa_battery, wa_plugged, wa_signal")
      .eq("gym_id", gymId)
      .maybeSingle();

    if (data?.wa_status) {
      return NextResponse.json({
        status:  data.wa_status,
        phone:   data.wa_phone   ?? undefined,
        battery: data.wa_battery ?? undefined,
        plugged: data.wa_plugged ?? undefined,
        signal:  data.wa_signal  ?? undefined,
      } satisfies WaStatusResponse);
    }
  }

  // ── 2. Pull directly from Ocean WA server ─────────────────────────────────
  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) return NextResponse.json({ status: "unknown" } satisfies WaStatusResponse);

  const headers: Record<string, string> = {};
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  try {
    const endpoint = gymId ? `${baseUrl}/status/${gymId}` : `${baseUrl}/status`;
    const { res, autoRestarted } = await healthCheckWithAutoRestart(baseUrl, headers, endpoint, gymId);

    if (!res || !res.ok) {
      if (!res) {
        console.error(`[WA-STATUS] gym_id=${gymId ?? "N/A"} → sin respuesta del motor — autoRestarted=${autoRestarted}`);
      } else {
        console.error(`[WA-STATUS] gym_id=${gymId ?? "N/A"} → HTTP ${res.status} del motor`);
      }
      return NextResponse.json({ status: "disconnected", autoRestarted } satisfies WaStatusResponse);
    }

    // Normalize common WA server response shapes:
    // waha:    { status: "WORKING", me: { id: "..." }, battery: { value: 85, charging: true } }
    // custom:  { status: "active", phone: "...", battery: 85, plugged: true, signal: 3 }
    const raw = await res.json() as Record<string, unknown>;

    const rawStatus = String(raw.status ?? "").toLowerCase();
    const status: WaStatusResponse["status"] =
      rawStatus === "active"  || rawStatus === "working"        ? "active" :
      rawStatus === "qr"      || rawStatus === "scan_qr_code"   ? "qr"     :
      rawStatus === "disconnected" || rawStatus === "failed"    ? "disconnected" : "unknown";

    const battery = raw.battery as { value?: number; charging?: boolean } | number | undefined;
    const batteryValue = typeof battery === "number" ? battery : battery?.value;
    const plugged      = typeof battery === "object"  ? battery?.charging : (raw.plugged as boolean | undefined);

    return NextResponse.json({
      status,
      phone:   (raw.phone as string | undefined) ?? ((raw.me as Record<string,string>)?.id),
      battery: batteryValue,
      plugged,
      signal:  raw.signal as number | undefined,
    } satisfies WaStatusResponse);
  } catch (err) {
    console.error(
      `[WA-STATUS] Error inesperado — gym_id=${gymId ?? "N/A"}`,
      `\n  error=${err instanceof Error ? err.message : String(err)}`,
      `\n  stack=${err instanceof Error ? err.stack : "N/A"}`,
    );
    return NextResponse.json({ status: "disconnected" } satisfies WaStatusResponse);
  }
}
