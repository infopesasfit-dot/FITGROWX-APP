import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { applyRateLimit, getClientIp } from "@/lib/request-security";

const supabase = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const limit = await applyRateLimit({ namespace: "verify-token:ip", identifier: getClientIp(req), windowMs: 60_000, maxAttempts: 40 });
  if (!limit.allowed) return NextResponse.json({ error: "Demasiados intentos. Esperá un momento." }, { status: 429 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Token requerido." }, { status: 400 });

  const tokenHash  = createHash("sha256").update(String(token)).digest("hex");
  const now        = new Date().toISOString();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch any non-expired token (used or not)
  const { data: tokenRow, error } = await supabase
    .from("alumno_tokens")
    .select("id, alumno_id, gym_id, used_at")
    .eq("token", tokenHash)
    .gt("expires_at", now)
    .single();

  if (error || !tokenRow) return NextResponse.json({ error: "Enlace inválido o expirado." }, { status: 401 });

  // First use: mark and extend expiry so the token works as a 30-day session
  if (!tokenRow.used_at) {
    await supabase
      .from("alumno_tokens")
      .update({ used_at: now, expires_at: thirtyDays })
      .eq("id", tokenRow.id);
  }

  const { data: alumno } = await supabase
    .from("alumnos")
    .select("id, dni, full_name, phone, status, plan_id, next_expiration_date, planes!plan_id(nombre, accent_color, precio)")
    .eq("id", tokenRow.alumno_id)
    .is("deleted_at", null)
    .single();

  return NextResponse.json({ ok: true, alumno, gym_id: tokenRow.gym_id });
}
