import { describe, expect, it, vi } from "vitest";
import { RateLimiter, requestIp } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows hits up to the configured max", async () => {
    const limiter = new RateLimiter(1000, 3);
    expect(await limiter.check("client")).toBe(false);
    expect(await limiter.check("client")).toBe(false);
    expect(await limiter.check("client")).toBe(false);
  });

  it("reports over-limit once maxHits is exceeded", async () => {
    const limiter = new RateLimiter(1000, 3);
    await limiter.check("client");
    await limiter.check("client");
    await limiter.check("client");
    expect(await limiter.check("client")).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const limiter = new RateLimiter(1000, 1);
    await limiter.check("a");
    expect(await limiter.check("b")).toBe(false);
  });

  it("forgets hits older than the window", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1000, 1);
    await limiter.check("client");
    await limiter.check("client");
    vi.advanceTimersByTime(1001);
    expect(await limiter.check("client")).toBe(false);
    vi.useRealTimers();
  });
});

describe("requestIp", () => {
  it("prefers x-forwarded-for, taking the first entry", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(requestIp(request)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(requestIp(request)).toBe("9.9.9.9");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const request = new Request("https://example.com");
    expect(requestIp(request)).toBe("unknown");
  });
});
