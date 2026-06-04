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
  ["/api/admin/upload-comprobante",   5_000_000], // 5MB
  ["/api/alumno/avatar",              2_000_000], // 2MB
  ["/api/admin/email-blast",            200_000], // 200KB
];

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
// Missing Content-Length is allowed (webhooks don't always send it).
// Returns 413 only when Content-Length is present and exceeds the limit.
export function enforceApiPayloadLimit(req: NextRequest): NextResponse | null {
  if (!BODY_METHODS.has(req.method.toUpperCase())) return null;
  if (!req.nextUrl.pathname.startsWith("/api/")) return null;

  const contentLength = req.headers.get("content-length");
  if (!contentLength) return null;

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
