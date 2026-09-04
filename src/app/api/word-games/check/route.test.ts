import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const getPuzzleById = vi.fn();
const getEntitlementTier = vi.fn();
const markStudyDayVisit = vi.fn();
const limiterCheck = vi.fn();

vi.mock("@/lib/word-games/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/word-games/data")>()),
  getPuzzleById: (...args: unknown[]) => getPuzzleById(...args),
}));
// Only getEntitlementTier is substituted. isFreeWordGamePuzzle and
// canAccessCurvedPuzzle come through untouched on purpose: they ARE the rule
// under test ("the route obeys exactly the puzzle page's rule"), and a
// hand-written copy of them here would keep passing after someone changed
// the real ones — the same reasoning as flashcards/summary/route.test.ts.
vi.mock("@/lib/entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlement")>()),
  getEntitlementTier: (...args: unknown[]) => getEntitlementTier(...args),
}));
vi.mock("@/lib/study-day-visit", () => ({
  markStudyDayVisit: (...args: unknown[]) => markStudyDayVisit(...args),
}));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimiter: () => ({ check: (...args: unknown[]) => limiterCheck(...args) }),
  requestIp: () => "10.0.0.1",
}));

const { POST } = await import("./route");

/** One horizontal word "дом" at row 0, col 0 — three answer cells, which is
 * enough for every assertion below and small enough to write the whole
 * solution out. */
function puzzle(over: Partial<{ level: string; sequence: number; curved: boolean; premiumOnly: boolean }> = {}) {
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

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body, headers: new Headers() } as unknown as NextRequest;
}

const ONE_GUESS = { puzzleId: "p1", guesses: [{ row: 0, col: 0, letter: "д" }] };

describe("POST /api/word-games/check — access rule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue(false);
    getEntitlementTier.mockResolvedValue("free");
    getPuzzleById.mockResolvedValue(puzzle());
  });

  it("grades a free-trial puzzle for a visitor with no subscription", async () => {
    const res = await POST(fakeRequest(ONE_GUESS));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual([{ row: 0, col: 0, correct: true }]);
  });

  it("refuses a paid puzzle for a visitor with no subscription", async () => {
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 11 }));
    const res = await POST(fakeRequest(ONE_GUESS));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "subscription_required" });
  });

  it("grades a paid puzzle for a standard subscriber", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 11 }));
    expect((await POST(fakeRequest(ONE_GUESS))).status).toBe(200);
  });

  // The gap this test was written for. 404 of production's 1262 crosswords
  // carry premiumOnly, and the puzzle page redirects a standard subscriber
  // off every one of them — while this route used to grade their letters,
  // which is the whole solution one oracle at a time.
  it("refuses a premiumOnly puzzle for a standard subscriber, exactly as the page does", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 98, premiumOnly: true }));
    const res = await POST(fakeRequest(ONE_GUESS));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "subscription_required" });
  });

  it("grades that same premiumOnly puzzle for Premium", async () => {
    getEntitlementTier.mockResolvedValue("premium");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 98, premiumOnly: true }));
    expect((await POST(fakeRequest(ONE_GUESS))).status).toBe(200);
  });

  // Control against a blind assertion: with premiumOnly cleared the same
  // standard subscriber must get through. Without it, "403 for standard"
  // above would also pass if the route simply refused every sequence 98.
  it("контроль на слепоту: та же клетка без premiumOnly проходит у standard", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 98, premiumOnly: false }));
    expect((await POST(fakeRequest(ONE_GUESS))).status).toBe(200);
  });
});

describe("POST /api/word-games/check — день занятия", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limiterCheck.mockResolvedValue(false);
    getEntitlementTier.mockResolvedValue("free");
    getPuzzleById.mockResolvedValue(puzzle());
  });

  it("отмечает день занятия на введённой букве", async () => {
    await POST(fakeRequest(ONE_GUESS));
    expect(markStudyDayVisit).toHaveBeenCalledWith("word-game");
  });

  it("не отмечает день, когда доступ закрыт", async () => {
    getPuzzleById.mockResolvedValue(puzzle({ sequence: 11 }));
    await POST(fakeRequest(ONE_GUESS));
    expect(markStudyDayVisit).not.toHaveBeenCalled();
  });

  it("не отмечает день, когда буквы не пришло", async () => {
    await POST(fakeRequest({ puzzleId: "p1", guesses: [] }));
    expect(markStudyDayVisit).not.toHaveBeenCalled();
  });

  it("не отмечает день, когда запрос отбит ограничителем частоты", async () => {
    limiterCheck.mockResolvedValue(true);
    const res = await POST(fakeRequest(ONE_GUESS));
    expect(res.status).toBe(429);
    expect(markStudyDayVisit).not.toHaveBeenCalled();
  });
});
