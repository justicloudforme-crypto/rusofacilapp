import "server-only";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Minimal in-process cache for read-heavy, rarely-changing data (glossary
 * terms today; course/exam content would be the next candidates) — a
 * deliberate stand-in for a real shared cache (Redis/Upstash have generous
 * free tiers) so the read path already has the shape a future swap needs,
 * without adding an external dependency before this app is actually
 * deployed anywhere.
 *
 * Important limit to remember when that day comes: a plain in-memory Map
 * is only correct behind a SINGLE server process. The moment there's more
 * than one instance behind a load balancer (which "millions of users"
 * implies), each instance has its own independent cache — a write on one
 * instance won't invalidate another's stale entry. At that point this
 * module's three functions are the seam to swap for real Redis calls
 * (`get`/`set`/`del` by prefix) without touching any call site.
 */
const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drops every entry whose key starts with `prefix` — call after any write
 * to the underlying data so a cached read doesn't outlive it. */
export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
