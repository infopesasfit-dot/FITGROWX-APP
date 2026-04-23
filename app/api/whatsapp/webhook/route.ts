import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Payload shapes from the Ocean WA server
type WaEvent =
  | { event: "qr";           qr: string;                                                                              gym_id?: string }
  | { event: "ready";        phone?: string; battery?: number; plugged?: boolean; signal?: number; creds_json?: string; gym_id?: string }
  | { event: "disconnected"; gym_id?: string }
  | { event: "battery";      battery: number; plugged?: boolean; signal?: number;                                     gym_id?: string };

export async function POST(req: NextRequest) {
  // ── Validate shared secret ──────────────────────────────────────────────────
  const secret = process.env.WA_WEBHOOK_SECRET;
  const incoming = req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret");
  console.log("[WA Webhook] request recibido — secret env:", secret, "| secret incoming:", incoming);

  if (secret && secret !== "cambia_esto_por_un_secreto") {
    if (incoming !== secret) {
      console.error("[WA Webhook] Unauthorized — secret no coincide");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = await req.json() as WaEvent;
  const gymId = body.gym_id ?? req.nextUrl.searchParams.get("gym_id");
  console.log("[WA Webhook] body recibido:", JSON.stringify(body), "| gymId:", gymId);

  if (!gymId) return NextResponse.json({ error: "gym_id required" }, { status: 400 });

  // ── Write state to Supabase ─────────────────────────────────────────────────
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const patch: Record<string, unknown> = { gym_id: gymId };

  if (body.event === "qr") {
    patch.wa_qr        = body.qr;
    patch.wa_status    = "qr";
    patch.wa_phone     = null;
    patch.wa_battery   = null;
    patch.wa_plugged   = null;
    patch.wa_signal    = null;
  } else if (body.event === "ready") {
    patch.wa_qr        = null;
    patch.wa_status    = "active";
    patch.wa_phone     = body.phone   ?? null;
    patch.wa_battery   = body.battery ?? null;
    patch.wa_plugged   = body.plugged ?? null;
    patch.wa_signal    = body.signal  ?? null;

    if (body.creds_json) {
      const { error: sessionErr } = await supabase.from("whatsapp_sessions").upsert(
        { gym_id: gymId, creds_json: body.creds_json, updated_at: new Date().toISOString() },
        { onConflict: "gym_id" },
      );
      if (sessionErr) {
        console.error("[WA Webhook] Error al guardar whatsapp_sessions:", sessionErr.message);
      } else {
        console.log("[WA Webhook] whatsapp_sessions guardado OK — gym_id:", gymId);
      }
    }
  } else if (body.event === "disconnected") {
    patch.wa_qr        = null;
    patch.wa_status    = "disconnected";
    patch.wa_phone     = null;
    patch.wa_battery   = null;
    patch.wa_plugged   = null;
    patch.wa_signal    = null;
  } else if (body.event === "battery") {
    patch.wa_battery = body.battery;
    patch.wa_plugged = body.plugged ?? null;
    patch.wa_signal  = body.signal  ?? null;
  }

  const { error: upsertErr } = await supabase.from("gym_settings").upsert(patch, { onConflict: "gym_id" });
  if (upsertErr) {
    console.error("[WA Webhook] Error al guardar en Supabase:", upsertErr.message);
  } else {
    console.log("[WA Webhook] gym_settings actualizado OK — gym_id:", gymId, "| patch:", JSON.stringify(patch));
  }

  return NextResponse.json({ ok: true });
}
