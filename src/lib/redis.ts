/**
 * Shared Upstash Redis client — backs both RateLimiter (src/lib/rate-limit.ts)
 * and TtlCache (src/lib/ttl-cache.ts) so their counters/cached values are
 * actually shared across serverless instances, unlike the in-memory Map
 * both used before. `null` when UPSTASH_REDIS_REST_URL/TOKEN aren't set —
 * every call site checks this and falls back to an in-memory Map, so local
 * development never needs a Redis account.
 */
import { Redis } from "@upstash/redis";
import { isDeployedEnvironment } from "./deploy-environment";

const globalForRedis = globalThis as unknown as { redis: Redis | null | undefined };

function createClient(): Redis | null {
  // Only ever on a real deployment. The local .env carries the production
  // Upstash credentials (it is pulled from Vercel), so before this gate a
  // local `next start` wrote into the live cache — measured on 28.08.2026:
  // 7 writes to the production Redis in a single page load, including the
  // full flashcard index. A stale or laptop-shaped value landing in the
  // shared cache is visible to real users for the length of its TTL.
  // Off-deployment this returns null and every call site falls back to its
  // in-process Map, which is the correct local behaviour anyway.
  if (!isDeployedEnvironment()) return null;
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
