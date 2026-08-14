/**
 * Minimal in-memory TTL cache for hot, read-heavy, infrequently-changing
 * lookups (subscription status, lesson content) — cuts duplicate DB round
 * trips under concurrent load without adding an external dependency.
 *
 * Deliberately shaped like a subset of a Redis client (get/set/del) so
 * swapping this for a real Redis-backed cache later (once the project
 * moves beyond a single instance, where an in-memory cache would go stale
 * across processes) only means changing this file, not every call site.
 */

/**
 * Stashes a module-level singleton on `globalThis`, exactly like
 * src/lib/db.ts already does for the Prisma client, and for the same
 * reason: Next.js's dev server (Turbopack) can compile Route Handlers and
 * Server Components into separate module graphs, each getting its own copy
 * of a plain `const` — so a cache written to by an API route and read by a
 * page wouldn't actually be the same object, silently breaking
 * invalidation (a write's `.del()` would call a different instance than
 * the one the page's `.get()` reads from). Keying by name and reusing an
 * existing instance across recompilations avoids that split.
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
  private readonly store = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  del(key: string): void {
    this.store.delete(key);
  }
}

/** get-or-populate: returns the cached value if fresh, otherwise calls
 * `load`, caches the result, and returns it. */
export async function cached<T>(cache: TtlCache<T>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = await load();
  cache.set(key, value);
  return value;
}
