import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const waMotorUrl = process.env.WA_MOTOR_URL;

  const [dbResult, waResult] = await Promise.all([
    (async () => {
      const t = Date.now();
      try {
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
        return { status: (error ? "error" : "ok") as "ok" | "error", latency_ms: Date.now() - t };
      } catch {
        return { status: "error" as const, latency_ms: Date.now() - t };
      }
    })(),
    (async () => {
      if (!waMotorUrl) return null;
      const t = Date.now();
      try {
        const res = await fetch(`${waMotorUrl}/health`, { signal: AbortSignal.timeout(3000) });
        return { status: (res.ok ? "ok" : "error") as "ok" | "error", latency_ms: Date.now() - t };
      } catch {
        return { status: "error" as const, latency_ms: Date.now() - t };
      }
    })(),
  ]);

  const checks: Record<string, "ok" | "error"> = { database: dbResult.status };
  if (waResult) checks.wa_motor = waResult.status;

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      latency_ms: dbResult.latency_ms,
      latency_detail: {
        database_ms: dbResult.latency_ms,
        ...(waResult ? { wa_motor_ms: waResult.latency_ms } : {}),
      },
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
