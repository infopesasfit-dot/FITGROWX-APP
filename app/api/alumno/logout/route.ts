import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { clearAlumnoSessionCookie } from "@/lib/alumno-session";
import { getAlumnoBearerToken, getAlumnoCookieToken } from "@/lib/alumno-token";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();
  const token = getAlumnoBearerToken(req) ?? getAlumnoCookieToken(req);

  // Invalidate token in DB if it exists
  if (token) {
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");
    const now = new Date().toISOString();
    await supabase
      .from("alumno_tokens")
      .update({ expires_at: now })
      .eq("token", tokenHash)
      .gt("expires_at", now);
  }

  const res = NextResponse.json({ ok: true });
  return clearAlumnoSessionCookie(res);
}
