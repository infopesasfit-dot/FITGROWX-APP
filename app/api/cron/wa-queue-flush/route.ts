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

  const startedAt = Date.now();

  if (!pending?.length) {
    void supabase.from("cron_runs").insert({ cron_name: "wa-queue-flush", status: "ok", duration_ms: Date.now() - startedAt, summary: "Cola vacía", counts: { enqueued: 0, failed: 0, pendingInBatch: 0, log: [] } });
    return NextResponse.json({ ok: true, enqueued: 0, log: ["Cola vacía"] });
  }

  const log: string[] = [];
  let enqueued = 0;
  let failed = 0;

  try {

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
        failed++;
        log.push(`✗ [${item.priority}] ${tag} — ${err}`);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : "unknown";
      await supabase.from("wa_queue")
        .update({ attempts: item.attempts + 1, error: err })
        .eq("id", item.id);
      failed++;
      log.push(`✗ [${item.priority}] ${tag} — ${err}`);
    }
  }

  void supabase.from("cron_runs").insert({ cron_name: "wa-queue-flush", status: "ok", duration_ms: Date.now() - startedAt, summary: `${enqueued}/${pending.length} mensajes entregados al motor`, counts: { enqueued, failed, pendingInBatch: pending.length, log } });
  return NextResponse.json({ ok: true, enqueued, pendingInBatch: pending.length, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    void supabase.from("cron_runs").insert({ cron_name: "wa-queue-flush", status: "error", duration_ms: Date.now() - startedAt, summary: msg });
    console.error("[wa-queue-flush] error fatal:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
