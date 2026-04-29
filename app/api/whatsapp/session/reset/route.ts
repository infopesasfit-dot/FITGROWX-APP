import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type AuthorizedProfile = {
  id: string;
  gym_id: string | null;
  role: "platform_owner" | "admin" | "staff" | string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey);
}

async function getAuthorizedProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, gym_id, role")
    .eq("id", user.id)
    .maybeSingle<AuthorizedProfile>();

  return profile ?? null;
}

/**
 * POST /api/whatsapp/session/reset?gym_id=...
 *
 * "Tiro de gracia" para sesiones corruptas. Hace 3 cosas en orden:
 *   1. Borra la sesión en el motor remoto (DELETE /session/{gymId})
 *   2. Limpia los campos wa_* en Supabase para que el estado quede en blanco
 *   3. Intenta pre-inicializar una sesión nueva (POST /session/{gymId}/init)
 *
 * Úsalo cuando el QR no carga y sospechas de un archivo de sesión corrompido.
 */
export async function POST(req: NextRequest) {
  const gymId = req.nextUrl.searchParams.get("gym_id");
  if (!gymId) return NextResponse.json({ error: "gym_id requerido" }, { status: 400 });
  const profile = await getAuthorizedProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (profile.role !== "platform_owner" && !(profile.role === "admin" && profile.gym_id === gymId)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    console.error("[WA-RESET] WA_MOTOR_URL no configurado");
    return NextResponse.json({ error: "WA_MOTOR_URL not configured" }, { status: 500 });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  const log: string[] = [];
  const ts = () => new Date().toISOString();

  console.log(`[WA-RESET] ▶ Inicio de reset — gym_id=${gymId} — ${ts()}`);

  // ── Paso 1: Borrar sesión en el motor ──────────────────────────────────────
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8_000);
    const res = await fetch(`${baseUrl}/session/${gymId}`, {
      method: "DELETE",
      headers,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const msg = `Paso 1 (DELETE /session/${gymId}): HTTP ${res.status}`;
    log.push(msg);
    console.log(`[WA-RESET] ${msg}`);
  } catch (err) {
    const msg = `Paso 1 (DELETE /session/${gymId}): FALLÓ — ${err instanceof Error ? err.message : String(err)}`;
    log.push(msg);
    console.error(`[WA-RESET] ⚠️  ${msg} (no es fatal, continuamos)`);
  }

  // ── Paso 2: Limpiar estado en Supabase ────────────────────────────────────
  try {
    const supabase = adminClient();
    const { error } = await supabase
      .from("gym_settings")
      .update({
        wa_status:  "disconnected",
        wa_qr:      null,
        wa_phone:   null,
        wa_battery: null,
        wa_plugged: null,
        wa_signal:  null,
      })
      .eq("gym_id", gymId);

    if (error) throw error;
    const msg = "Paso 2 (Supabase wa_* limpiado): OK";
    log.push(msg);
    console.log(`[WA-RESET] ${msg}`);
  } catch (err) {
    const msg = `Paso 2 (Supabase): FALLÓ — ${err instanceof Error ? err.message : String(err)}`;
    log.push(msg);
    console.error(`[WA-RESET] ❌ ${msg}`);
  }

  // ── Paso 3: Pre-init sesión nueva en el motor ─────────────────────────────
  const initUrls = [
    `${baseUrl}/session/${gymId}/init`,
    `${baseUrl}/session/${gymId}/start`,
    `${baseUrl}/session`,   // algunos motores aceptan POST con body { gymId }
  ];

  let initiated = false;
  for (const url of initUrls) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: url.endsWith("/session") ? JSON.stringify({ gymId }) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok || res.status === 409 /* ya existe */) {
        const msg = `Paso 3 (init nueva sesión vía ${url}): HTTP ${res.status}`;
        log.push(msg);
        console.log(`[WA-RESET] ✅ ${msg}`);
        initiated = true;
        break;
      }
      console.warn(`[WA-RESET] ${url} devolvió ${res.status} — probando siguiente…`);
    } catch (err) {
      console.warn(`[WA-RESET] ${url} no disponible: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!initiated) {
    const msg = "Paso 3 (init): ningún endpoint de init disponible — el motor levantará la sesión en el próximo QR poll";
    log.push(msg);
    console.warn(`[WA-RESET] ⚠️  ${msg}`);
  }

  console.log(`[WA-RESET] ✅ Reset completado — gym_id=${gymId} — ${ts()}`);

  return NextResponse.json({ ok: true, steps: log });
}
