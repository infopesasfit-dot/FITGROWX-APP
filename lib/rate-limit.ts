const store = new Map<string, number[]>();

/**
 * Sliding-window in-memory rate limiter.
 * Returns true if the request is allowed, false if rate limit exceeded.
 * Per-instance (Vercel serverless) — sufficient for abuse prevention on low-traffic public routes.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now  = Date.now();
  const hits = (store.get(key) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  store.set(key, hits);
  return true;
}

export function getClientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown")
    .split(",")[0]
    .trim();
}
