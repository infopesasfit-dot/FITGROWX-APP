import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, normalizeIdentifier } from "@/lib/request-security";

export async function applyAlumnoRateLimit(
  req: NextRequest,
  alumno_id: string,
  config: { windowMs?: number; maxAttempts?: number } = {}
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const { windowMs = 60 * 1000, maxAttempts = 30 } = config;

  const limit = await applyRateLimit({
    namespace: "alumno-api",
    identifier: normalizeIdentifier(alumno_id),
    windowMs,
    maxAttempts,
  });

  if (!limit.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Demasiadas solicitudes. Intentá en un momento." },
        { status: 429 }
      ),
    };
  }

  return { allowed: true };
}
