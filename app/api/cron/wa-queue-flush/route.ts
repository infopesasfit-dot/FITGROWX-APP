import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isCronAuthorized, cronUnauthorized } from "@/lib/request-security";

export const dynamic = "force-dynamic";

const MOTOR_URL = process.env.WA_MOTOR_URL ?? "";
const BATCH = 50;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  if (!MOTOR_URL) return NextResponse.json({ ok: false, log: ["WA_MOTOR_URL no configurado"] });

  const supabase = getSupabaseAdminClient();

  // Atomic claim via FOR UPDATE SKIP LOCKED
  const { data: pending } = await supabase.rpc("claim_wa_queue_batch", { p_batch: BATCH });

  if (!pending?.length) return NextResponse.json({ ok: true, enqueued: 0, log: ["Cola vacía"] });

  const log: string[] = [];
  let enqueued = 0;

  for (const item of pending) {
    const tag = `gym=${item.gym_id.slice(0, 8)} tel=···${item.phone.slice(-4)}`;
    try {
      // Encolar en BullMQ (motor maneja reintentos con backoff exponencial)
      const res = await fetch(`${MOTOR_URL}/enqueue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: item.gym_id,
          phone: item.phone,
          message: item.message
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (res.ok || res.status === 202) {
        await supabase.from("wa_queue")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.id);
        enqueued++;
        log.push(`✓ [${item.priority}] ${tag}`);
      } else {
        const err = `HTTP ${res.status}`;
        await supabase.from("wa_queue")
          .update({ attempts: item.attempts + 1, error: err })
          .eq("id", item.id);
        log.push(`✗ [${item.priority}] ${tag} — ${err}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "unknown";
      await supabase.from("wa_queue")
        .update({ attempts: item.attempts + 1, error: err })
        .eq("id", item.id);
      log.push(`✗ [${item.priority}] ${tag} — ${err}`);
    }
  }

  return NextResponse.json({ ok: true, enqueued, pendingInBatch: pending.length, log });
}
