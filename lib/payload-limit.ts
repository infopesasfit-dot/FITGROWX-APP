import { NextRequest, NextResponse } from "next/server";

export const PAYLOAD_LIMITS = {
  JSON_DEFAULT: 100_000,       // 100KB for JSON
  WEBHOOK: 100_000,            // 100KB for webhooks
  CSV: 5_000_000,              // 5MB for CSV uploads
  PHOTO: 10_000_000,           // 10MB for photo uploads
  QR: 500_000,                 // 500KB for QR data
};

function formatSize(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)}MB`
    : `${Math.round(bytes / 1000)}KB`;
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
