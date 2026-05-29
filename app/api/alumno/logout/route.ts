import { NextRequest, NextResponse } from "next/server";
import { clearAlumnoSessionCookie } from "@/lib/alumno-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient();

  const res = NextResponse.json({ ok: true });
  return clearAlumnoSessionCookie(res);
}
