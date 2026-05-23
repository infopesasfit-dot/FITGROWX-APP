import { getClientIp } from "@/lib/request-security";
import type { NextRequest } from "next/server";

type TurnstileSiteVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function verifyTurnstileToken(req: NextRequest, token: string | null | undefined): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true };
    }

    return {
      ok: false,
      status: 500,
      error: "La validación de seguridad no está configurada. Revisá TURNSTILE_SECRET_KEY.",
    };
  }

  if (!token) {
    return {
      ok: false,
      status: 400,
      error: "Completá la validación de seguridad antes de enviar.",
    };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const clientIp = getClientIp(req);
    if (clientIp && clientIp !== "unknown") {
      body.set("remoteip", clientIp);
    }

    let lastError: Error | null = null;
    const maxRetries = 1;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
          signal: AbortSignal.timeout(3000),
        });

        if (!response.ok) {
          return {
            ok: false,
            status: 502,
            error: "No pudimos validar la protección anti-bot. Intentá de nuevo.",
          };
        }

        const data = await response.json() as TurnstileSiteVerifyResponse;
        if (!data.success) {
          return {
            ok: false,
            status: 403,
            error: "No pudimos validar la verificación de seguridad. Intentá otra vez.",
          };
        }

        return { ok: true };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTimeout = err instanceof DOMException && err.name === "AbortError";

        // Retry on timeout
        if (isTimeout && attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }

        return {
          ok: false,
          status: 502,
          error: "No pudimos validar la protección anti-bot. Intentá de nuevo.",
        };
      }
    }

    return {
      ok: false,
      status: 502,
      error: "No pudimos validar la protección anti-bot. Intentá de nuevo.",
    };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "No pudimos validar la protección anti-bot. Intentá de nuevo.",
    };
  }
}
