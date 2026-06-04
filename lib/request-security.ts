import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export function isCronAuthorized(req: NextRequest): boolean {
  const bearer   = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const expected = process.env.CRON_SECRET ?? "";
  if (!bearer || !expected) return false;
  try {
    const a = Buffer.from(bearer);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function cronUnauthorized() {
  return NextResponse.json({ error: "No autorizado." }, { status: 401 });
}

export function getClientIp(req: NextRequest) {
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)!.trim();

  return "127.0.0.1";
}

export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

// ── Rate limiting via Upstash Redis (persiste entre deploys/cold starts) ──────
// Fallback a in-memory si las env vars no están configuradas (desarrollo local)

let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch { /* fallback to in-memory */ }

const limiters = new Map<string, Ratelimit>();

function getLimiter(namespace: string, windowMs: number, maxAttempts: number): Ratelimit | null {
  if (!redis) return null;
  const key = `${namespace}:${windowMs}:${maxAttempts}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxAttempts, `${windowMs}ms`),
      prefix: `fitgrowx:rl:${namespace}`,
    }));
  }
  return limiters.get(key)!;
}

// In-memory fallback (development / no Redis configured)
type RateLimitEntry = { count: number; resetAt: number };
declare global { var __fitgrowxRateLimitStore: Map<string, RateLimitEntry> | undefined; }
function getMemStore() {
  if (!globalThis.__fitgrowxRateLimitStore) globalThis.__fitgrowxRateLimitStore = new Map();
  return globalThis.__fitgrowxRateLimitStore;
}

export async function applyRateLimit(options: {
  namespace: string;
  identifier: string;
  windowMs: number;
  maxAttempts: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limiter = getLimiter(options.namespace, options.windowMs, options.maxAttempts);

  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(`${options.identifier}`);
    return { allowed: success, remaining, resetAt: reset };
  }

  // Fallback in-memory
  const now = Date.now();
  const store = getMemStore();
  const key = `${options.namespace}:${options.identifier}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.maxAttempts - 1, resetAt: now + options.windowMs };
  }
  if (existing.count >= options.maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  store.set(key, existing);
  return { allowed: true, remaining: options.maxAttempts - existing.count, resetAt: existing.resetAt };
}
