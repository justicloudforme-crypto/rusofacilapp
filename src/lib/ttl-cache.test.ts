import { describe, expect, it, vi } from "vitest";
import { TtlCache, cached, getOrCreateGlobalSingleton } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns a stored value before it expires", async () => {
    const cache = new TtlCache<string>(1000, "test");
    await cache.set("a", "hello");
    expect(await cache.get("a")).toBe("hello");
  });

  it("returns undefined for a missing key", async () => {
    const cache = new TtlCache<string>(1000, "test");
    expect(await cache.get("missing")).toBeUndefined();
  });

  it("expires a value once its TTL has passed", async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000, "test");
    await cache.set("a", "hello");
    vi.advanceTimersByTime(1001);
    expect(await cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });

  it("removes a value on del", async () => {
    const cache = new TtlCache<string>(1000, "test");
    await cache.set("a", "hello");
    await cache.del("a");
    expect(await cache.get("a")).toBeUndefined();
  });
});

describe("cached", () => {
  it("calls load and caches the result on a miss", async () => {
    const cache = new TtlCache<string>(1000, "test");
    const load = vi.fn().mockResolvedValue("loaded");
    const result = await cached(cache, "key", load);
    expect(result).toBe("loaded");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not call load again on a hit", async () => {
    const cache = new TtlCache<string>(1000, "test");
    const load = vi.fn().mockResolvedValue("loaded");
    await cached(cache, "key", load);
    const result = await cached(cache, "key", load);
    expect(result).toBe("loaded");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("getOrCreateGlobalSingleton", () => {
  it("returns the same instance across calls with the same key", () => {
    const create = vi.fn(() => ({}));
    const first = getOrCreateGlobalSingleton("test-key-a", create);
    const second = getOrCreateGlobalSingleton("test-key-a", create);
    expect(first).toBe(second);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("returns different instances for different keys", () => {
    const first = getOrCreateGlobalSingleton("test-key-b", () => ({ tag: "b" }));
    const second = getOrCreateGlobalSingleton("test-key-c", () => ({ tag: "c" }));
    expect(first).not.toBe(second);
  });
});

/**
 * The crash of 30.08.2026 — Sentry JAVASCRIPT-NEXTJS-K, 19 events in one
 * burst at 15:00:19 PDT on release ebf297c, then silence.
 *
 * PR #110 changed what `getSubscriptionsForUser` stores under
 * `ttlcache:subscription:<userId>` from a single `Subscription | null` to a
 * `Subscription[]`. Namespace and key stayed the same, and Redis is shared
 * by every instance AND across deploys — so for the 30 seconds the pre-
 * deploy entries had left to live, the new code read the old shape back and
 * called `.map` on an object. `TypeError: (intermediate value).map is not a
 * function`, thrown inside Navbar, which renders on every page of the site.
 *
 * The burst ended because the entries expired, not because anything was
 * fixed. These tests are the fix: a value that is not the shape this cache
 * stores today is a MISS, not a hit.
 */
describe("a cached value of the wrong shape", () => {
  it("is discarded, so the caller reads through instead of crashing", async () => {
    const cache = new TtlCache<string[]>(1000, "rows", Array.isArray);
    // Exactly what the pre-#110 deploy left behind: one row, not a list.
    await cache.set("user-1", { id: "sub_1", plan: "monthly" } as unknown as string[]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cache.get("user-1")).toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it("cached() then reloads from the source, and the caller can .map it", async () => {
    const cache = new TtlCache<string[]>(1000, "rows", Array.isArray);
    await cache.set("user-1", { id: "sub_1" } as unknown as string[]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = await cached(cache, "user-1", async () => ["a", "b"]);
    expect(() => rows.map((r) => r.toUpperCase())).not.toThrow();
    expect(rows).toEqual(["a", "b"]);
    vi.restoreAllMocks();
  });

  it("a value of the right shape is still a hit", async () => {
    // Otherwise the guard would turn the cache off entirely and every test
    // above would pass while the cache did nothing.
    const cache = new TtlCache<string[]>(1000, "rows", Array.isArray);
    await cache.set("user-1", ["a"]);
    expect(await cache.get("user-1")).toEqual(["a"]);
  });

  it("positive control: without the guard the same entry reaches .map and throws", async () => {
    // The crash itself, reproduced. This is what every array-valued cache
    // in the app did before this change.
    const unguarded = new TtlCache<string[]>(1000, "rows");
    await unguarded.set("user-1", { id: "sub_1" } as unknown as string[]);
    const rows = await cached(unguarded, "user-1", async () => ["a", "b"]);
    expect(() => (rows as string[]).map((r) => r)).toThrow(TypeError);
    expect(() => (rows as string[]).map((r) => r)).toThrow(/map is not a function/);
  });
});

/**
 * Every cache that stores a list must carry the guard. Listed by reading
 * the source rather than by importing the modules, which are `server-only`
 * and would pull the Prisma client into a unit test.
 */
describe("every TtlCache declares what shape it holds", () => {
  it("no cache is constructed without a validator", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join, relative } = await import("node:path");
    const SRC = join(process.cwd(), "src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== "generated") walk(full);
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(full);
      }
    };
    walk(SRC);
    const offenders: string[] = [];
    let found = 0;
    for (const file of files) {
      for (const match of readFileSync(file, "utf8").matchAll(/new TtlCache<[\s\S]*?>\(([\s\S]*?)\)[,;\s)]/g)) {
        found++;
        const args = match[1];
        if (!/Array\.isArray|isPlainObject/.test(args)) offenders.push(`${relative(SRC, file)}: ${args.trim().slice(0, 60)}`);
      }
    }
    // Without this the scan could match nothing and pass vacuously.
    expect(found).toBeGreaterThan(8);
    expect(offenders).toEqual([]);
  });
});
