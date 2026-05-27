import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const COOKIE = "fitgrowx_ref";
const TTL_DAYS = 30;
const sb = getSupabaseAdminClient();

export async function POST(req: NextRequest) {
  // 15 intentos por IP por minuto
  if (!rateLimit(`reseller_track:${getClientIp(req)}`, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { slug } = await req.json();
  if (!slug?.trim()) return NextResponse.json({ error: "slug requerido" }, { status: 400 });

  // Don't overwrite an existing attribution that's still valid
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.json({ ok: true, slug: existing, reused: true });

  const { data: reseller } = await sb
    .from("resellers")
    .select("id, slug")
    .eq("slug", slug.trim())
    .eq("status", "active")
    .maybeSingle();

  if (!reseller) {
    return NextResponse.json({ error: "reseller inválido" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, slug: reseller.slug });
  res.cookies.set(COOKIE, reseller.slug, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   TTL_DAYS * 24 * 60 * 60,
    secure:   process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const existing = req.cookies.get(COOKIE)?.value;
  if (!existing) return NextResponse.json({ ok: true, cleared: false });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
