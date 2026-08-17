import { describe, expect, it } from "vitest";
import { buildMatchRound, countPlayableCards } from "./match-round";
import type { FlashcardRow } from "./index";

function makeCard(id: string, emoji: string): FlashcardRow {
  return {
    id,
    category: "food",
    level: "A1",
    emoji,
    russian: id,
    transcription: id,
    translationEs: id,
    exampleRu: "",
    exampleEs: "",
    synonyms: [],
    antonyms: [],
  };
}

describe("buildMatchRound", () => {
  it("returns the requested number of cards when enough distinct-icon cards exist", () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard(`c${i}`, `emoji-${i}`));
    const round = buildMatchRound(cards, 4);
    expect(round).toHaveLength(4);
  });

  it("excludes cards with an empty emoji", () => {
    const cards = [makeCard("a", "🍎"), makeCard("b", ""), makeCard("c", "   "), makeCard("d", "🍞")];
    const round = buildMatchRound(cards, 4);
    expect(round.map((c) => c.id).sort()).toEqual(["a", "d"]);
  });

  it("never picks two cards sharing the same emoji", () => {
    const cards = [
      makeCard("a", "🍎"),
      makeCard("b", "🍎"), // duplicate icon — ambiguous, must be excluded
      makeCard("c", "🍞"),
      makeCard("d", "🥕"),
    ];
    const round = buildMatchRound(cards, 4);
    const emojis = round.map((c) => c.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
    expect(round).toHaveLength(3); // only 3 distinct icons available
  });

  it("returns fewer than size when the pool is too small", () => {
    const cards = [makeCard("a", "🍎"), makeCard("b", "🍞")];
    const round = buildMatchRound(cards, 4);
    expect(round).toHaveLength(2);
  });
});

describe("countPlayableCards", () => {
  it("counts distinct-icon cards, matching what buildMatchRound would actually use", () => {
    const cards = [
      makeCard("a", "🍎"),
      makeCard("b", "🍎"), // duplicate — doesn't add a playable pair
      makeCard("c", "🍞"),
      makeCard("d", ""), // no icon — not playable
    ];
    expect(countPlayableCards(cards)).toBe(2);
  });

  it("returns 0 for an empty or icon-less pool", () => {
    expect(countPlayableCards([])).toBe(0);
    expect(countPlayableCards([makeCard("a", "")])).toBe(0);
  });
});
