import { NextRequest } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

declare global {
  var __fitgrowxRateLimitStore: RateLimitStore | undefined;
}

function getStore(): RateLimitStore {
  if (!globalThis.__fitgrowxRateLimitStore) {
    globalThis.__fitgrowxRateLimitStore = new Map<string, RateLimitEntry>();
  }

  return globalThis.__fitgrowxRateLimitStore;
}

export function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return req.headers.get("x-real-ip") ?? "unknown";
}

export function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

export function applyRateLimit(options: {
  namespace: string;
  identifier: string;
  windowMs: number;
  maxAttempts: number;
}) {
  const now = Date.now();
  const store = getStore();
  const key = `${options.namespace}:${options.identifier}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      allowed: true,
      remaining: options.maxAttempts - 1,
      resetAt: now + options.windowMs,
    };
  }

  if (existing.count >= options.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    remaining: options.maxAttempts - existing.count,
    resetAt: existing.resetAt,
  };
}
