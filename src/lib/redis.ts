/**
 * Shared Upstash Redis client — backs both RateLimiter (src/lib/rate-limit.ts)
 * and TtlCache (src/lib/ttl-cache.ts) so their counters/cached values are
 * actually shared across serverless instances, unlike the in-memory Map
 * both used before. `null` when UPSTASH_REDIS_REST_URL/TOKEN aren't set —
 * every call site checks this and falls back to an in-memory Map, so local
 * development never needs a Redis account.
 */
import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as { redis: Redis | null | undefined };

function createClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Same globalThis-singleton reasoning as db.ts / the old
// getOrCreateGlobalSingleton in ttl-cache.ts: avoids reconstructing the
// client across Next.js's separate Route Handler / Server Component module
// graphs in dev.
export const redis = globalForRedis.redis !== undefined ? globalForRedis.redis : createClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
