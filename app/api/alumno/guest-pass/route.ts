import { NextRequest, NextResponse } from "next/server";
import { requireAlumnoActionAllowed } from "@/lib/alumno-action-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { randomBytes } from "crypto";

const sb = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  const access = await requireAlumnoActionAllowed(req);
  if ("response" in access) return access.response;
  const { tokenRow } = access;

  const { alumno_id, gym_id } = tokenRow;

  // Only 1 active pass per alumno
  const { data: existing } = await sb
    .from("guest_passes")
    .select("id, token, expires_at, status")
    .eq("alumno_id", alumno_id)
    .in("status", ["pending", "claimed"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitgrowx.com";

  if (existing) {
    return NextResponse.json({
      passUrl: `${appUrl}/pase/${existing.token}`,
      expiresAt: existing.expires_at,
      alreadyExists: true,
    });
  }

  const token     = randomBytes(20).toString("hex");
  const code      = token.slice(0, 6).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await sb.from("guest_passes").insert({ gym_id, alumno_id, token, code, expires_at: expiresAt });

  return NextResponse.json({
    passUrl: `${appUrl}/pase/${token}`,
    expiresAt,
    alreadyExists: false,
  });
}
