import { NextRequest, NextResponse } from "next/server";

export const PAYLOAD_LIMITS = {
  JSON_DEFAULT: 100_000,       // 100KB for JSON
  WEBHOOK: 100_000,            // 100KB for webhooks
  CSV: 5_000_000,              // 5MB for CSV uploads
  PHOTO: 10_000_000,           // 10MB for photo uploads
  QR: 500_000,                 // 500KB for QR data
};

// Per-route overrides for middleware enforcement (prefix match, longest first)
const API_LIMITS: [string, number][] = [
  ["/api/alumno/fotos",              10_000_000], // 10MB
  ["/api/pagos/upload-comprobante",   5_000_000], // 5MB
  ["/api/alumno/avatar",              2_000_000], // 2MB
  ["/api/admin/email-blast",            200_000], // 200KB
];

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MISSING_CONTENT_LENGTH_ALLOWED = new Set([
  "/api/mp/webhook",
  "/api/mp/gym-webhook",
  "/api/webhooks/wa-motor",
  "/api/whatsapp/webhook",
]);

function formatSize(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)}MB`
    : `${Math.round(bytes / 1000)}KB`;
}

function getApiLimit(pathname: string): number {
  for (const [prefix, limit] of API_LIMITS) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return limit;
  }
  return 100_000;
}

// Middleware-level check for all /api/* routes.
// Missing Content-Length is denied by default; only provider webhooks are allowlisted.
export function enforceApiPayloadLimit(req: NextRequest): NextResponse | null {
  if (!BODY_METHODS.has(req.method.toUpperCase())) return null;
  if (!req.nextUrl.pathname.startsWith("/api/")) return null;

  const contentLength = req.headers.get("content-length");
  if (!contentLength) {
    if (MISSING_CONTENT_LENGTH_ALLOWED.has(req.nextUrl.pathname)) return null;
    return NextResponse.json(
      { error: "Content-Length header requerido." },
      { status: 411 }
    );
  }

  const bytes = parseInt(contentLength, 10);
  if (isNaN(bytes)) return null;

  const maxBytes = getApiLimit(req.nextUrl.pathname);
  if (bytes > maxBytes) {
    return NextResponse.json(
      { error: `Payload demasiado grande. Máximo permitido: ${formatSize(maxBytes)}.` },
      { status: 413 }
    );
  }

  return null;
}

export function enforcePayloadLimit(
  req: NextRequest,
  maxBytes: number,
  opts?: { allowMissingContentLength?: boolean }
): NextResponse | null {
  const contentLength = req.headers.get("content-length");

  if (!contentLength) {
    if (opts?.allowMissingContentLength) {
      return null;
    }
    return NextResponse.json(
      { error: "Content-Length header requerido." },
      { status: 411 }
    );
  }

  const bytes = parseInt(contentLength, 10);
  if (isNaN(bytes)) {
    return NextResponse.json(
      { error: "Content-Length inválido." },
      { status: 411 }
    );
  }

  if (bytes > maxBytes) {
    return NextResponse.json(
      { error: `Payload demasiado grande. Máximo permitido: ${formatSize(maxBytes)}.` },
      { status: 413 }
    );
  }

  return null;
}
