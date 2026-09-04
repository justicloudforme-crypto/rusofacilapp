import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getPuzzleById = vi.fn();
const getEntitlementTier = vi.fn();
const limiterCheck = vi.fn();

vi.mock("@/lib/word-games/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/word-games/data")>()),
  getPuzzleById: (...args: unknown[]) => getPuzzleById(...args),
}));
// Same substitution boundary as check/route.test.ts: only the tier lookup is
// faked, so isFreeWordGamePuzzle/canAccessCurvedPuzzle stay the real rule.
vi.mock("@/lib/entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlement")>()),
  getEntitlementTier: (...args: unknown[]) => getEntitlementTier(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimiter: () => ({ check: (...args: unknown[]) => limiterCheck(...args) }),
  requestIp: () => "10.0.0.1",
}));

const { POST } = await import("./route");

function puzzle(over: Partial<{ sequence: number; premiumOnly: boolean }> = {}) {
  return {
    id: "p1",
    type: "CROSSWORD" as const,
    level: "A1",
    sequence: 1,
    curved: false,
    premiumOnly: false,
    topic: null,
    grid: { grid: [["д", "о", "м"]] },
    words: [{ word: "дом", row: 0, col: 0, direction: "E" as const, number: 1, clue: "casa" }],
    ...over,
  };
}

const fakeRequest = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as NextRequest;
const ONE_CELL = { puzzleId: "p1", row: 0, col: 0 };

// /hint hands over a letter outright, so its gate matters at least as much
// as /check's. Same rule, same matrix.
describe("POST /api/word-games/hint — access rule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue(false);
    getEntitlementTier.mockResolvedValue("free");
    getPuzzleById.mockResolvedValue(puzzle());
  });

  it("reveals a letter of a free-trial puzzle without a subscription", async () => {
    const res = await POST(fakeRequest(ONE_CELL));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ row: 0, col: 0, letter: "д" });
  });

  it("refuses a paid puzzle without a subscription", async () => {
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 11 }));
    expect((await POST(fakeRequest(ONE_CELL))).status).toBe(403);
  });

  it("refuses a premiumOnly puzzle for a standard subscriber, exactly as the page does", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 98, premiumOnly: true }));
    expect((await POST(fakeRequest(ONE_CELL))).status).toBe(403);
  });

  it("контроль на слепоту: та же клетка без premiumOnly проходит у standard", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 98, premiumOnly: false }));
    expect((await POST(fakeRequest(ONE_CELL))).status).toBe(200);
  });
});
