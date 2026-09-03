import { beforeEach, describe, expect, it, vi } from "vitest";

// Where the day boundary comes from when the account has not told us yet.
//
// The order is the whole subject of this file, because each source covers a
// case the one before it cannot, and getting the order wrong is silent: a
// wrong zone never throws, it just moves days.

const cookieStore = new Map<string, string>();
const headerStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined) }),
  headers: async () => ({ get: (name: string) => headerStore.get(name) ?? null }),
}));

const { getRequestTimeZone } = await import("./timezone-server");
const { TIMEZONE_COOKIE, VERCEL_TIMEZONE_HEADER } = await import("./timezone");

beforeEach(() => {
  cookieStore.clear();
  headerStore.clear();
});

describe("getRequestTimeZone", () => {
  it("prefers the account column over everything else", async () => {
    cookieStore.set(TIMEZONE_COOKIE, "Europe/Madrid");
    headerStore.set(VERCEL_TIMEZONE_HEADER, "Asia/Tokyo");
    expect(await getRequestTimeZone("America/Mexico_City")).toBe("America/Mexico_City");
  });

  it("falls back to the cookie when the column is empty", async () => {
    cookieStore.set(TIMEZONE_COOKIE, "Europe/Madrid");
    headerStore.set(VERCEL_TIMEZONE_HEADER, "Asia/Tokyo");
    expect(await getRequestTimeZone(null)).toBe("Europe/Madrid");
  });

  it("THE FIRST PAGE LOAD: with no column and no cookie, the edge header answers", async () => {
    // This is the request that marks a new learner's first study day. The
    // cookie is written by a client effect, so it cannot exist yet.
    headerStore.set(VERCEL_TIMEZONE_HEADER, "America/Mexico_City");
    expect(await getRequestTimeZone(null)).toBe("America/Mexico_City");
  });

  it("POSITIVE CONTROL: without the header that same request is UTC — a day off in Mexico", async () => {
    const { dateKeyIn } = await import("./timezone");
    const zone = await getRequestTimeZone(null);
    expect(zone).toBe("UTC");
    const evening = new Date("2026-09-11T01:00:00.000Z"); // 19:00 on the 10th, Mexico City
    expect(dateKeyIn(evening, zone)).toBe("2026-09-11");
    expect(dateKeyIn(evening, "America/Mexico_City")).toBe("2026-09-10");
  });

  it("ignores junk from any of the three, rather than throwing on it", async () => {
    headerStore.set(VERCEL_TIMEZONE_HEADER, "Not/AZone");
    cookieStore.set(TIMEZONE_COOKIE, "../../etc/passwd");
    expect(await getRequestTimeZone("Mars/Olympus")).toBe("UTC");
  });
});
