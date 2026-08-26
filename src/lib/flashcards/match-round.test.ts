import { describe, expect, it } from "vitest";
import { buildMatchRound, countPlayableCards } from "./match-round";
import type { FlashcardRow } from "./index";

function makeCard(id: string, russian: string): FlashcardRow {
  return {
    id,
    category: "food",
    level: "A1",
    emoji: "🍎",
    russian,
    transcription: russian,
    translationEs: russian,
    exampleRu: "",
    exampleEs: "",
    synonyms: [],
    antonyms: [],
  };
}

describe("buildMatchRound", () => {
  it("returns the requested number of cards when enough distinct-word cards exist", () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`, `слово${i}`));
    const round = buildMatchRound(cards, 4);
    expect(round).toHaveLength(4);
  });

  it("excludes cards with an empty word", () => {
    const cards = [makeCard("a", "яблоко"), makeCard("b", ""), makeCard("c", "   "), makeCard("d", "хлеб")];
    const round = buildMatchRound(cards, 4);
    expect(round.map((c) => c.id).sort()).toEqual(["a", "d"]);
  });

  it("never picks two cards with the same Russian word (case-insensitive)", () => {
    const cards = [
      makeCard("a", "яблоко"),
      makeCard("b", "Яблоко"), // duplicate word — ambiguous, must be excluded
      makeCard("c", "хлеб"),
      makeCard("d", "морковь"),
    ];
    const round = buildMatchRound(cards, 4);
    const words = round.map((c) => c.russian.toLowerCase());
    expect(new Set(words).size).toBe(words.length);
    expect(round).toHaveLength(3); // only 3 distinct words available
  });

  it("does not filter cards sharing the same emoji — the old icon-uniqueness rule was for the emoji-matching mechanic, no longer used", () => {
    const cards = [makeCard("a", "яблоко"), makeCard("b", "хлеб"), makeCard("c", "морковь")].map((c) => ({
      ...c,
      emoji: "🛍️", // all three share one icon, on purpose
    }));
    const round = buildMatchRound(cards, 4);
    expect(round).toHaveLength(3);
  });

  it("returns fewer than size when the pool is too small", () => {
    const cards = [makeCard("a", "яблоко"), makeCard("b", "хлеб")];
    const round = buildMatchRound(cards, 4);
    expect(round).toHaveLength(2);
  });

  it("gives a different card selection/order across repeated calls on the same pool", () => {
    const cards = Array.from({ length: 30 }, (_, i) => makeCard(`card-${i}`, `слово${i}`));
    const runs = Array.from({ length: 8 }, () => buildMatchRound(cards, 8).map((c) => c.id).join(","));
    expect(new Set(runs).size).toBeGreaterThan(1);
  });
});

describe("countPlayableCards", () => {
  it("counts distinct-word cards, matching what buildMatchRound would actually use", () => {
    const cards = [
      makeCard("a", "яблоко"),
      makeCard("b", "яблоко"), // duplicate — doesn't add a playable pair
      makeCard("c", "хлеб"),
      makeCard("d", ""), // no word — not playable
    ];
    expect(countPlayableCards(cards)).toBe(2);
  });

  it("returns 0 for an empty or word-less pool", () => {
    expect(countPlayableCards([])).toBe(0);
    expect(countPlayableCards([makeCard("a", "")])).toBe(0);
  });
});
