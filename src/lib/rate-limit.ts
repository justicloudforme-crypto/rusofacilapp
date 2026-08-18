/**
 * Rate limiter for every mutating route that needs basic abuse protection.
 * Backed by Upstash Redis (INCR+EXPIRE, one shared counter per key across
 * every serverless instance) when UPSTASH_REDIS_REST_URL/TOKEN are set —
 * see src/lib/redis.ts. Falls back to an in-memory sliding-window Map when
 * they aren't, so local dev works with zero Redis setup. That fallback is
 * per-process only: fine for a single dev server, not for a real
 * multi-instance deploy, which is exactly why the Redis path exists.
 */

import { redis } from "./redis";
import { getOrCreateGlobalSingleton } from "./ttl-cache";

export class RateLimiter {
  // Only used by the in-memory fallback path.
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxHits: number,
  ) {}

  /** Records one hit for `key` and reports whether it exceeds the limit. */
  async check(key: string): Promise<boolean> {
    if (redis) return this.checkRedis(key);
    return this.checkInMemory(key);
  }

  // Fixed-window counter (INCR+EXPIRE) rather than the in-memory fallback's
  // sliding window — one Redis round trip, good enough at this traffic
  // scale. A sliding window can come back later if fixed-window edge
  // effects (a burst right at the window boundary) actually matter.
  private async checkRedis(key: string): Promise<boolean> {
    const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / this.windowMs)}`;
    const hits = await redis!.incr(windowKey);
    if (hits === 1) await redis!.expire(windowKey, Math.ceil(this.windowMs / 1000));
    return hits > this.maxHits;
  }

  private checkInMemory(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length > this.maxHits;
  }
}

/** Creates (or reuses) a named RateLimiter via the same globalThis-anchored
 * singleton pattern as before — still needed for the in-memory fallback
 * path (a plain module-level instance can end up duplicated across
 * Next.js's separate Route Handler and Server Component module graphs in
 * dev, splitting one counter into several). Harmless no-op concern when
 * Redis is configured, since Redis state is shared by key regardless of
 * how many RateLimiter instances exist. */
export function getRateLimiter(name: string, windowMs: number, maxHits: number): RateLimiter {
  return getOrCreateGlobalSingleton(`rateLimiter_${name}`, () => new RateLimiter(windowMs, maxHits));
}

/** Best-effort client identifier for routes that must rate-limit before an
 * authenticated user is known (e.g. login) — falls back across the headers
 * a reverse proxy typically sets, then the raw connection as a last resort. */
export function requestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
