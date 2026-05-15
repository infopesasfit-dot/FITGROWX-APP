import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const MOTOR_URL = process.env.WA_MOTOR_URL ?? "";
const MOTOR_KEY = process.env.WA_MOTOR_API_KEY ?? "";
const BATCH = 12; // ~12 envíos × 4 s/envío ≈ 48 s < timeout de 60 s

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  if (!MOTOR_URL) return NextResponse.json({ ok: false, log: ["WA_MOTOR_URL no configurado"] });

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  // 'bulk' > 'high' alfabéticamente → order ASC pone 'high' primero ✓
  const { data: pending } = await supabase
    .from("wa_queue")
    .select("id, gym_id, phone, message, priority, attempts")
    .is("sent_at", null)
    .is("failed_at", null)
    .lte("scheduled_at", now)
    .lt("attempts", 3)
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);

  if (!pending?.length) return NextResponse.json({ ok: true, sent: 0, log: ["Cola vacía"] });

  const log: string[] = [];
  let sent = 0;

  for (const item of pending) {
    const tag = `gym=${item.gym_id.slice(0, 8)} tel=···${item.phone.slice(-4)}`;
    try {
      const res = await fetch(`${MOTOR_URL}/send/${item.gym_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": MOTOR_KEY },
        body: JSON.stringify({ phone: item.phone, message: item.message }),
        signal: AbortSignal.timeout(8_000),
      });

      if (res.ok) {
        await supabase.from("wa_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.id);
        sent++;
        log.push(`✓ [${item.priority}] ${tag}`);
      } else {
        const err = `HTTP ${res.status}`;
        const giveUp = item.attempts >= 2;
        await supabase.from("wa_queue")
          .update({ attempts: item.attempts + 1, error: err, ...(giveUp ? { failed_at: new Date().toISOString() } : {}) })
          .eq("id", item.id);
        log.push(`✗ [${item.priority}] ${tag} — ${err}${giveUp ? " (dado de baja)" : ""}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "unknown";
      const giveUp = item.attempts >= 2;
      await supabase.from("wa_queue")
        .update({ attempts: item.attempts + 1, error: err, ...(giveUp ? { failed_at: new Date().toISOString() } : {}) })
        .eq("id", item.id);
      log.push(`✗ [${item.priority}] ${tag} — ${err}${giveUp ? " (dado de baja)" : ""}`);
    }
  }

  return NextResponse.json({ ok: true, sent, pendingInBatch: pending.length, log });
}
