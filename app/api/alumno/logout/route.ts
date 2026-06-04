import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { clearAlumnoSessionCookie, getAlumnoTokenFromCookie } from "@/lib/alumno-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();

  const bearerToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") || null;
  const token = bearerToken ?? getAlumnoTokenFromCookie(req);
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await supabase
      .from("alumno_tokens")
      .update({ expires_at: new Date().toISOString() })
      .eq("token", tokenHash);
  }

  const res = NextResponse.json({ ok: true });
  return clearAlumnoSessionCookie(res);
}
