import { NextRequest, NextResponse } from "next/server";
import { clearAlumnoSessionCookie } from "@/lib/alumno-session";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  return clearAlumnoSessionCookie(res);
}
