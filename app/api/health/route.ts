import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    checks.database = error ? "error" : "ok";
  } catch {
    checks.database = "error";
  }

  const waMotorUrl = process.env.WA_MOTOR_URL;
  if (waMotorUrl) {
    try {
      const res = await fetch(`${waMotorUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.wa_motor = res.ok ? "ok" : "error";
    } catch {
      checks.wa_motor = "error";
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      checks,
      latency_ms: Date.now() - start,
      ts: new Date().toISOString(),
    },
    { status }
  );
}
