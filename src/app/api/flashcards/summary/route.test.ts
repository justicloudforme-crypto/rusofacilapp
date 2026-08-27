import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const findMany = vi.fn();
const getCurrentUser = vi.fn();
const getFlashcardIndex = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { flashcardProgress: { findMany: (...args: unknown[]) => findMany(...args) } },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUser(...args) }));
vi.mock("@/lib/flashcards/cache", () => ({ getFlashcardIndex: (...args: unknown[]) => getFlashcardIndex(...args) }));

const { POST } = await import("./route");

function fakeRequest(body: unknown): NextRequest {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { text: async () => text } as unknown as NextRequest;
}

const INDEX = [
  { id: "food-1", category: "food", level: "A1" },
  { id: "food-2", category: "food", level: "A1" },
  { id: "city-1", category: "city", level: "A1" },
];

describe("POST /api/flashcards/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFlashcardIndex.mockResolvedValue(INDEX);
    getCurrentUser.mockResolvedValue(null);
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
