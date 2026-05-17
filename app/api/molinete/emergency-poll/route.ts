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

  const now = new Date().toISOString();

  // Atomically find and consume a pending, non-expired token
  const { data: token } = await admin
    .from("emergency_opens")
    .select("id")
    .eq("gym_id", keyRow.gym_id)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) return NextResponse.json({ open: false });

  // Consume the token
  await admin
    .from("emergency_opens")
    .update({ consumed_at: now })
    .eq("id", token.id)
    .is("consumed_at", null); // guard against race condition

  return NextResponse.json({ open: true });
}
