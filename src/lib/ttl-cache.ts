/**
 * TTL cache for hot, read-heavy, infrequently-changing lookups (subscription
 * status, lesson/exam content, flashcards, idioms). Backed by Upstash Redis
 * (native EX/PX expiry, one shared cache across every serverless instance)
 * when UPSTASH_REDIS_REST_URL/TOKEN are set — see src/lib/redis.ts. Falls
 * back to an in-memory Map when they aren't, so local dev works with zero
 * Redis setup — that fallback is per-process only, which is exactly why the
 * Redis path exists for production.
 */

import { redis } from "./redis";

/**
 * Stashes a module-level singleton on `globalThis`, exactly like
 * src/lib/db.ts already does for the Prisma client, and for the same
 * reason: Next.js's dev server (Turbopack) can compile Route Handlers and
 * Server Components into separate module graphs, each getting its own copy
 * of a plain `const` — so a cache written to by an API route and read by a
 * page wouldn't actually be the same object, silently breaking
 * invalidation (a write's `.del()` would call a different instance than
 * the one the page's `.get()` reads from). Keying by name and reusing an
 * existing instance across recompilations avoids that split. Only matters
 * for the in-memory fallback path — a Redis-backed cache is already shared
 * by key regardless of how many TtlCache instances exist.
 */
export function getOrCreateGlobalSingleton<T>(key: string, create: () => T): T {
  const registry = globalThis as unknown as Record<string, T | undefined>;
  const globalKey = `__rusofasil_${key}`;
  if (!registry[globalKey]) registry[globalKey] = create();
  return registry[globalKey] as T;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  // Only used by the in-memory fallback path.
  private readonly store = new Map<string, Entry<T>>();

  /** `namespace` prefixes every Redis key so different TtlCache instances
   * (lesson content, exam content, subscriptions, flashcards...) can't
   * collide on the same shared Redis keyspace even if two of them happen
   * to use the same inner key string. Public (not just used internally) so
   * `cached()` below can build a matching de-dupe key for stampede
   * protection without needing its own copy of the namespace. */
  constructor(
    private readonly ttlMs: number,
    public readonly namespace: string,
  ) {}

  private redisKey(key: string): string {
    return `ttlcache:${this.namespace}:${key}`;
  }

  // A Redis error (wrong/expired token, network blip, Upstash outage) must
  // never take down the page that's reading through this cache — get/set/
  // del all fail soft: get() treats an error as a miss (cached() below
  // then just reads through to the DB, same as a cold cache), set()/del()
  // swallow it (a failed cache write/invalidation isn't worth failing the
  // request over). Not falling back to the in-memory `store` here on a
  // Redis error, unlike RateLimiter — a half-populated local Map would be
  // inconsistent with what other instances see, whereas "always re-read
  // from the DB" is simply always correct, just uncached.
  async get(key: string): Promise<T | undefined> {
    if (redis) {
      try {
        const value = await redis.get<T>(this.redisKey(key));
        return value ?? undefined;
      } catch (error) {
        console.error(`[ttl-cache] Redis get failed for ${this.redisKey(key)}, treating as a miss`, error);
        return undefined;
      }
    }
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: T): Promise<void> {
    if (redis) {
      try {
        await redis.set(this.redisKey(key), value, { px: this.ttlMs });
      } catch (error) {
        console.error(`[ttl-cache] Redis set failed for ${this.redisKey(key)}`, error);
      }
      return;
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async del(key: string): Promise<void> {
    if (redis) {
      try {
        await redis.del(this.redisKey(key));
      } catch (error) {
        console.error(`[ttl-cache] Redis del failed for ${this.redisKey(key)}`, error);
      }
      return;
    }
    this.store.delete(key);
  }
}

// Cache-stampede protection: tracks loads currently in flight, keyed by
// namespace+key, across every TtlCache in this process. Without this, a
// burst of concurrent requests arriving while a key is cold (first hit
// after startup, or right as a TTL expires) would each independently call
// `load()` — for a full-table query like the flashcard index, dozens of
// simultaneous heavy reads against the same local SQLite file pile up and
// serialize each other into multi-second timeouts (confirmed empirically:
// 30 concurrent cold requests to GET /api/flashcards took 7-15s each
// before this fix). Only per-process, not cross-instance like Redis itself
// — on Vercel each serverless instance could still fire one redundant load
// on its own first cold hit, but that's a single query, not a stampede of
// concurrent ones, so a distributed lock isn't worth the complexity here.
const inFlight = new Map<string, Promise<unknown>>();

/** get-or-populate: returns the cached value if fresh, otherwise calls
 * `load`, caches the result, and returns it. Concurrent callers that miss
 * the same cold key share one in-flight `load()` call instead of each
 * firing their own. */
export async function cached<T>(cache: TtlCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cache.get(key);
  if (hit !== undefined) return hit;

  const dedupeKey = `${cache.namespace}:${key}`;
  const existing = inFlight.get(dedupeKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    const value = await load();
    await cache.set(key, value);
    return value;
  })().finally(() => inFlight.delete(dedupeKey));

  inFlight.set(dedupeKey, promise);
  return promise;
}
