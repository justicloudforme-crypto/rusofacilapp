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
   * to use the same inner key string. */
  constructor(
    private readonly ttlMs: number,
    private readonly namespace: string,
  ) {}

  private redisKey(key: string): string {
    return `ttlcache:${this.namespace}:${key}`;
  }

  async get(key: string): Promise<T | undefined> {
    if (redis) {
      const value = await redis.get<T>(this.redisKey(key));
      return value ?? undefined;
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
      await redis.set(this.redisKey(key), value, { px: this.ttlMs });
      return;
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async del(key: string): Promise<void> {
    if (redis) {
      await redis.del(this.redisKey(key));
      return;
    }
    this.store.delete(key);
  }
}

/** get-or-populate: returns the cached value if fresh, otherwise calls
 * `load`, caches the result, and returns it. */
export async function cached<T>(cache: TtlCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await cache.get(key);
  if (hit !== undefined) return hit;
  const value = await load();
  await cache.set(key, value);
  return value;
}
