import { NextRequest, NextResponse } from "next/server";

const COOKIE = "fitgrowx_ref";
const TTL_DAYS = 30;

export async function POST(req: NextRequest) {
  const { slug } = await req.json();
  if (!slug?.trim()) return NextResponse.json({ error: "slug requerido" }, { status: 400 });

  // Don't overwrite an existing attribution that's still valid
  const existing = req.cookies.get(COOKIE)?.value;
  if (existing) return NextResponse.json({ ok: true, slug: existing, reused: true });

  const res = NextResponse.json({ ok: true, slug: slug.trim() });
  res.cookies.set(COOKIE, slug.trim(), {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   TTL_DAYS * 24 * 60 * 60,
    secure:   process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
