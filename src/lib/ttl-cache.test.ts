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
