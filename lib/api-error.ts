import { NextResponse } from "next/server";

/**
 * Maps any error (Supabase PostgrestError, thrown Error, string) to a
 * user-facing message that never leaks internal DB details.
 */
export function sanitizeError(err: unknown): string {
  const raw = (
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : String(err ?? "")
  ).toLowerCase();

  if (raw.includes("timeout") || raw.includes("timed out") || raw.includes("statement timeout"))
    return "La consulta tardó demasiado. Reintentá en un momento.";
  if (raw.includes("too many connections") || raw.includes("connection pool") || raw.includes("max_connections"))
    return "Estamos con mucha demanda. Reintentá en un minuto.";
  if (raw.includes("connection refused") || raw.includes("econnrefused") || raw.includes("fetch failed"))
    return "No se pudo conectar al servidor. Reintentá en un momento.";
  if (raw.includes("jwt") || raw.includes("invalid token"))
    return "Sesión inválida. Volvé a ingresar.";
  if (raw.includes("permission denied") || raw.includes("row-level security"))
    return "No tenés permiso para realizar esta acción.";

  return "Ocurrió un error inesperado. Reintentá en un momento.";
}

/** Wraps a route handler in try/catch — catches thrown errors (network, SDK bugs). */
export function withApiHandler<Req>(
  handler: (req: Req) => Promise<NextResponse>
): (req: Req) => Promise<NextResponse> {
  return async (req: Req) => {
    try {
      return await handler(req);
    } catch (e) {
      console.error("[api-error]", e);
      return NextResponse.json({ error: sanitizeError(e) }, { status: 500 });
    }
  };
}
