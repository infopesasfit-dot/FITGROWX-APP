import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit } from "@/lib/request-security";

/** DELETE /api/whatsapp/session — limpia ghost sessions antes de pedir un QR nuevo */
export async function DELETE(req: NextRequest) {
  // ── 1. Authenticate user ────────────────────────────────────────────────────
  const supabaseServer = await createSupabaseServerClient();
  const { data: { user } } = await supabaseServer.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // ── 2. Get user's gym_id and verify role (owner/admin) ─────────────────────
  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("gym_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.gym_id || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  }

  const gymId = profile.gym_id;

  // ── 3. Apply rate limit (destructive op: 5 per minute) ──────────────────────
  const rl = await applyRateLimit({
    namespace: "wa_session",
    identifier: `${user.id}:${gymId}`,
    windowMs: 60_000,
    maxAttempts: 5,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit excedido. Reintentá más tarde." },
      { status: 429 }
    );
  }

  const baseUrl = process.env.WA_MOTOR_URL;
  if (!baseUrl) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const headers: Record<string, string> = {};
  if (process.env.WA_MOTOR_API_KEY) headers["x-api-key"] = process.env.WA_MOTOR_API_KEY;

  try {
    // Fire-and-forget: si la sesión no existe el motor devuelve 404, lo ignoramos
    await fetch(`${baseUrl}/session/${gymId}`, { method: "DELETE", headers });
  } catch {
    // No es fatal — continuar igual
  }
  return NextResponse.json({ ok: true });
}
