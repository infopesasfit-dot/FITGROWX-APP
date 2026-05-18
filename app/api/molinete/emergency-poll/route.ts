import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp } from "@/lib/request-security";

const admin = getSupabaseAdminClient();

/**
 * Hardware polls this endpoint every 3 seconds.
 * If a pending emergency_open token exists for the gym, it is consumed and
 * the response tells the hardware to open the door.
 *
 * Auth: same x-api-key used in /api/molinete/access
 */
export async function GET(req: NextRequest) {
  const limit = await applyRateLimit({
    namespace: "molinete-emergency:ip",
    identifier: getClientIp(req),
    windowMs: 60_000,
    maxAttempts: 120, // 2 req/s at 3s interval = well within limit
  });
  if (!limit.allowed) return NextResponse.json({ open: false }, { status: 429 });

  const rawKey = req.headers.get("x-api-key")?.trim();
  if (!rawKey) return NextResponse.json({ open: false }, { status: 401 });

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const { data: keyRow } = await admin
    .from("molinete_api_keys")
    .select("id, gym_id")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle<{ id: string; gym_id: string }>();

  if (!keyRow) return NextResponse.json({ open: false }, { status: 401 });

  // Single atomic UPDATE via Postgres function — eliminates SELECT→UPDATE race
  const { data } = await admin.rpc("consume_emergency_open", { p_gym_id: keyRow.gym_id });

  return NextResponse.json({ open: data != null });
}
