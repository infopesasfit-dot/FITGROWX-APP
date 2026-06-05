import { NextResponse } from "next/server";

export type AlumnoSession = {
  alumno_id: string;
  gym_id: string;
  full_name: string;
  status: string;
  plan: string | null;
  expiration: string | null;
  dni: string | null;
};

export function setAlumnoSessionCookie(res: NextResponse, token: string, maxAge = 30 * 24 * 60 * 60): NextResponse {
  res.cookies.set("fitgrowx_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
  return res;
}

export function clearAlumnoSessionCookie(res: NextResponse): NextResponse {
  res.cookies.delete("fitgrowx_token");
  return res;
}

export function getAlumnoTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/fitgrowx_token=([^;]+)/);
  return match?.[1] ?? null;
}
