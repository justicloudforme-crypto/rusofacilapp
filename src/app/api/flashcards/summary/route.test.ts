import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const findMany = vi.fn();
const getCurrentUser = vi.fn();
const getFlashcardIndex = vi.fn();
const getEntitlementTier = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { flashcardProgress: { findMany: (...args: unknown[]) => findMany(...args) } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/lib/flashcards/cache", () => ({ getFlashcardIndex: (...args: unknown[]) => getFlashcardIndex(...args) }));
// Only getEntitlementTier is substituted — canAccessLevel comes through
// untouched, on purpose: it IS the rule under test here ("C1 needs
// Premium"), and a hand-written copy of it in this mock would keep passing
// after someone changed the real one.
vi.mock("@/lib/entitlement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlement")>()),
  getEntitlementTier: (...args: unknown[]) => getEntitlementTier(...args),
}));

const { POST } = await import("./route");

function fakeRequest(body: unknown): NextRequest {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { text: async () => text } as unknown as NextRequest;
}

// Four cards, one of them C1 — so "the whole bank" and "what a
// non-Premium visitor can open" are two different numbers here, which is
// the only way the assertions below can tell them apart.
const INDEX = [
  { id: "food-1", category: "food", level: "A1" },
  { id: "food-2", category: "food", level: "A1" },
  { id: "city-1", category: "city", level: "A1" },
  { id: "abstract-c1", category: "abstract", level: "C1" },
];

describe("POST /api/flashcards/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFlashcardIndex.mockResolvedValue(INDEX);
    getCurrentUser.mockResolvedValue(null);
    getEntitlementTier.mockResolvedValue("free");
    findMany.mockResolvedValue([]);
  });

  it("computes real per-category known counts for a guest from the client's local entries", async () => {
    const res = await POST(
      fakeRequest({
        entries: {
          "food-1": { known: true, updatedAt: 100 },
          "food-2": { known: false, updatedAt: 200 },
        },
      })
    );
    const body = await res.json();
    expect(body.categories.food).toEqual({ total: 2, known: 1 });
    expect(body.totalKnown).toBe(1);
    expect(body.hasAnyProgress).toBe(true);
  });

  it("rejects a payload with more entries than real cards exist", async () => {
    const bloated: Record<string, { known: boolean; updatedAt: number }> = {};
    for (let i = 0; i < INDEX.length + 1; i++) bloated[`fake-${i}`] = { known: true, updatedAt: 1 };
    const res = await POST(fakeRequest({ entries: bloated }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(fakeRequest("not json"));
    expect(res.status).toBe(400);
  });

  it("silently drops entries with the wrong shape or an unknown cardId, instead of erroring", async () => {
    const res = await POST(
      fakeRequest({
        entries: {
          "food-1": { known: "yes", updatedAt: 100 }, // wrong type
          "does-not-exist": { known: true, updatedAt: 100 }, // not a real card
          "food-2": { known: true, updatedAt: 100 }, // valid
        },
      })
    );
    const body = await res.json();
    expect(body.categories.food).toEqual({ total: 2, known: 1 });
  });

  it("server progress always wins over a client entry claiming the same card is unknown", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ cardId: "food-1", known: true, updatedAt: new Date(500) }]);

    const res = await POST(
      fakeRequest({
        // A forged/stale client payload trying to "unknow" a card the
        // server already has real progress for.
        entries: { "food-1": { known: false, updatedAt: 999999 } },
      })
    );
    const body = await res.json();
    expect(body.categories.food.known).toBe(1);
    expect(body.totalKnown).toBe(1);
  });

  it("lets the client fill in a card the server has no record of at all", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([{ cardId: "food-1", known: true, updatedAt: new Date(500) }]);

    const res = await POST(
      fakeRequest({
        entries: { "city-1": { known: true, updatedAt: 100 } }, // server has never seen this card
      })
    );
    const body = await res.json();
    expect(body.categories.city.known).toBe(1);
    expect(body.totalKnown).toBe(2); // server's food-1 + client-only city-1
  });

  it("returns the most recently active categories, capped at 3", async () => {
    const res = await POST(
      fakeRequest({
        entries: {
          "food-1": { known: true, updatedAt: 300 },
          "city-1": { known: false, updatedAt: 500 }, // "repeat", still real activity
        },
      })
    );
    const body = await res.json();
    expect(body.recent.map((r: { category: string }) => r.category)).toEqual(["city", "food"]);
  });
});

/**
 * The denominator, per tier.
 *
 * Before this, the endpoint answered `totalWords = index.length` — the
 * whole bank — and the result panel printed it as "6 из 5683" to a visitor
 * who could open 4787 of them. Arithmetically the fraction was consistent;
 * as a statement about what the learner could study, it was not.
 *
 * Three tiers, three expectations, on BOTH numbers. Asserting only
 * `availableWords` would pass on an implementation that forgot
 * `premiumOnlyWords` entirely, and vice versa.
 */
describe("POST /api/flashcards/summary — the denominator is what this visitor can open", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFlashcardIndex.mockResolvedValue(INDEX);
    getCurrentUser.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
  });

  it("no subscription: C1 is out of the denominator and named as locked", async () => {
    getEntitlementTier.mockResolvedValue("free");
    const body = await (await POST(fakeRequest({}))).json();
    expect(body.availableWords).toBe(3);
    expect(body.premiumOnlyWords).toBe(1);
    expect(body.categories.abstract).toBeUndefined();
  });

  it("monthly/annual subscription: same as free here — C1 is a Premium slice, not a paid-vs-unpaid one", async () => {
    getEntitlementTier.mockResolvedValue("standard");
    const body = await (await POST(fakeRequest({}))).json();
    expect(body.availableWords).toBe(3);
    expect(body.premiumOnlyWords).toBe(1);
  });

  it("Premium: the whole bank is the denominator and nothing is locked", async () => {
    getEntitlementTier.mockResolvedValue("premium");
    const body = await (await POST(fakeRequest({}))).json();
    expect(body.availableWords).toBe(4);
    expect(body.premiumOnlyWords).toBe(0);
    expect(body.categories.abstract).toEqual({ total: 1, known: 0 });
  });

  it("the numerator is counted over the same set as the denominator", async () => {
    // A learner who studied a C1 card while on Premium and then lapsed:
    // the row survives in flashcardProgress. It must not count toward
    // "known" while the card itself is out of reach — otherwise the
    // fraction claims progress on cards the page will not open.
    getEntitlementTier.mockResolvedValue("free");
    getCurrentUser.mockResolvedValue({ id: "user-1" });
    findMany.mockResolvedValue([
      { cardId: "food-1", known: true, updatedAt: new Date(100) },
      { cardId: "abstract-c1", known: true, updatedAt: new Date(200) },
    ]);
    const body = await (await POST(fakeRequest({}))).json();
    expect(body.totalKnown).toBe(1);
    expect(body.availableWords).toBe(3);

    getEntitlementTier.mockResolvedValue("premium");
    const premium = await (await POST(fakeRequest({}))).json();
    expect(premium.totalKnown).toBe(2);
    expect(premium.availableWords).toBe(4);
  });

  it("a client payload sized to the WHOLE bank is still accepted at a tier that cannot open all of it", async () => {
    // The ceiling is the whole bank on purpose: a lapsed-Premium device
    // legitimately holds entries for cards it can no longer open, and
    // rejecting the request would blank every progress bar on the page.
    getEntitlementTier.mockResolvedValue("free");
    const res = await POST(
      fakeRequest({
        entries: {
          "food-1": { known: true, updatedAt: 1 },
          "food-2": { known: true, updatedAt: 1 },
          "city-1": { known: true, updatedAt: 1 },
          "abstract-c1": { known: true, updatedAt: 1 },
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalKnown).toBe(3); // the C1 entry is dropped, not counted
    expect(body.availableWords).toBe(3);
  });

  /**
   * The positive control. Everything above could pass on an endpoint that
   * hardcoded 3 and 1, so: plant one more C1 card in the bank and assert
   * which of the two numbers moves. A free visitor's denominator must not
   * budge, and the locked count must go up by exactly one — a check that
   * cannot show this cannot show it is measuring the bank at all.
   */
  it("positive control: one planted C1 card moves the locked count by one and the denominator by zero", async () => {
    getEntitlementTier.mockResolvedValue("free");
    const before = await (await POST(fakeRequest({}))).json();

    getFlashcardIndex.mockResolvedValue([
      ...INDEX,
      { id: "abstract-c1-planted", category: "abstract", level: "C1" },
    ]);
    const after = await (await POST(fakeRequest({}))).json();

    expect(after.availableWords).toBe(before.availableWords);
    expect(after.premiumOnlyWords).toBe(before.premiumOnlyWords + 1);

    // And the mirror image, so the control cannot pass by the endpoint
    // simply never moving: for Premium the SAME planted card moves the
    // denominator instead, and leaves nothing locked.
    getEntitlementTier.mockResolvedValue("premium");
    const premium = await (await POST(fakeRequest({}))).json();
    expect(premium.availableWords).toBe(before.availableWords + 2);
    expect(premium.premiumOnlyWords).toBe(0);
  });

  /**
   * The negative half: a planted A1 card must move the denominator and
   * leave the locked count alone. Without it, "the denominator did not
   * move" above would also pass on an endpoint that ignores the bank
   * entirely.
   */
  it("negative control: a planted A1 card moves the denominator, not the locked count", async () => {
    getEntitlementTier.mockResolvedValue("free");
    const before = await (await POST(fakeRequest({}))).json();

    getFlashcardIndex.mockResolvedValue([
      ...INDEX,
      { id: "food-planted", category: "food", level: "A1" },
    ]);
    const after = await (await POST(fakeRequest({}))).json();

    expect(after.availableWords).toBe(before.availableWords + 1);
    expect(after.premiumOnlyWords).toBe(before.premiumOnlyWords);
  });
});
