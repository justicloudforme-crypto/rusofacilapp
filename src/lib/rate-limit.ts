/**
 * Shared in-memory sliding-window rate limiter — the same pattern already
 * used ad hoc in /api/voice-submissions, extracted so every mutating route
 * that needs basic abuse protection uses one implementation instead of
 * copy-pasting the timestamp-array logic.
 *
 * In-memory and per-process, same tradeoff as the voice-submissions
 * limiter it's extracted from: fine for a single instance, and each
 * limiter's state resets on deploy/restart. Once the app runs as more than
 * one process (see rusofasil_project_state memory on scaling), replace the
 * Map in RateLimiter with a Redis INCR+EXPIRE-backed store — call sites
 * don't need to change, only this file.
 */

import { getOrCreateGlobalSingleton } from "./ttl-cache";

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxHits: number,
  ) {}

  /** Records one hit for `key` and reports whether it exceeds the limit. */
  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length > this.maxHits;
  }
}

/** Creates (or reuses) a named RateLimiter via the same globalThis-anchored
 * singleton pattern as the TTL caches (see getOrCreateGlobalSingleton) —
 * required for the same reason: a plain module-level `const RateLimiter`
 * instance can end up duplicated across Next.js's separate Route Handler
 * and Server Component module graphs in dev, silently limiting each graph
 * independently instead of sharing one counter. Prefer this over
 * `new RateLimiter(...)` at module scope for anything reachable from more
 * than one route. */
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
