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

/** Shape guard for the caches that store one object (lesson content, exam
 * content, homepage stats, weak topic). Its counterpart for the caches that
 * store a list is `Array.isArray` itself — passed directly, since that is
 * exactly the check the crash of 30.08.2026 needed and did not have. */
export function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  /** `isValidValue` is the shape guard, and it is not optional paranoia —
   * it is the fix for a real production crash (30.08.2026, Sentry
   * JAVASCRIPT-NEXTJS-K, 19 events).
   *
   * The Redis half of this cache is shared by every running instance AND by
   * every DEPLOY. PR #110 changed what `getSubscriptionsForUser` stores
   * under `ttlcache:subscription:<userId>` from one `Subscription | null`
   * to a `Subscription[]`, keeping the namespace and the key. For the 30
   * seconds it took the pre-deploy entries to expire, the new code read the
   * old shape back and ran `.map` on an object — `TypeError: (intermediate
   * value).map is not a function`, thrown inside Navbar, which renders on
   * every page.
   *
   * `redis.get<T>()` is a cast, not a check: T is erased at build time, so
   * nothing in the type system can see across a deploy boundary. Only a
   * runtime predicate can. A value that fails it is treated exactly like a
   * miss — dropped, logged once, and re-read from the database — which is
   * the only safe direction: silently returning `[]` for a subscription
   * would quietly downgrade a paying student to the free tier.
   */
  constructor(
    private readonly ttlMs: number,
    public readonly namespace: string,
    private readonly isValidValue?: (value: unknown) => boolean,
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
  /** A cached value that is not the shape this cache stores today. Treated
   * as a miss, so the caller reads through to the database. Logged, not
   * swallowed: an entry of the wrong shape means a deploy changed a payload
   * without changing its key, and that is worth seeing once. */
  private accept(key: string, value: unknown): T | undefined {
    if (value === null || value === undefined) return undefined;
    if (this.isValidValue && !this.isValidValue(value)) {
      console.error(
        `[ttl-cache] ${this.redisKey(key)} holds a value of the wrong shape (${
          Array.isArray(value) ? "array" : typeof value
        }) — discarding it and reading through. A deploy changed this payload without changing its key.`
      );
      return undefined;
    }
    return value as T;
  }

  async get(key: string): Promise<T | undefined> {
    if (redis) {
      try {
        return this.accept(key, await redis.get<T>(this.redisKey(key)));
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
    return this.accept(key, entry.value);
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
