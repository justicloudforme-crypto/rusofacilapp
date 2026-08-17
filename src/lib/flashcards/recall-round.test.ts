import { describe, expect, it } from "vitest";
import { buildRecallRound, checkRecallAnswer } from "./recall-round";
import type { FlashcardRow } from "./index";
import type { SrsEntry } from "../flashcard-progress";

function makeCard(id: string): FlashcardRow {
  return {
    id,
    category: "food",
    level: "A1",
    emoji: "🍎",
    russian: id,
    transcription: id,
    translationEs: id,
    exampleRu: "",
    exampleEs: "",
    synonyms: [],
    antonyms: [],
  };
}

describe("checkRecallAnswer", () => {
  it("accepts an exact match", () => {
    expect(checkRecallAnswer("собака", "собака")).toBe("correct");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(checkRecallAnswer("  Собака  ", "собака")).toBe("correct");
  });

  it("treats ё and е as equivalent", () => {
    expect(checkRecallAnswer("елка", "ёлка")).toBe("correct");
    expect(checkRecallAnswer("ёлка", "елка")).toBe("correct");
  });

  it("flags a single-letter typo on a long word as almost", () => {
    expect(checkRecallAnswer("халодильник", "холодильник")).toBe("almost");
  });

  it("does not grant almost-credit on short words", () => {
    // "он" vs "она" is a 1-edit distance but a genuinely different word —
    // the length floor exists precisely to avoid rewarding this as "close".
    expect(checkRecallAnswer("он", "она")).toBe("incorrect");
  });

  it("rejects an unrelated word", () => {
    expect(checkRecallAnswer("яблоко", "холодильник")).toBe("incorrect");
  });

  it("rejects an empty answer", () => {
    expect(checkRecallAnswer("", "слово")).toBe("incorrect");
  });
});

describe("buildRecallRound", () => {
  it("returns every card, shuffled, when the category is smaller than the round size", () => {
    const cards = [makeCard("a"), makeCard("b"), makeCard("c")];
    const round = buildRecallRound(cards, {}, 10);
    expect(round).toHaveLength(3);
    expect(new Set(round.map((c) => c.id))).toEqual(new Set(["a", "b", "c"]));
  });

  it("never repeats a card within one round", () => {
    const cards = Array.from({ length: 40 }, (_, i) => makeCard(`card-${i}`));
    const round = buildRecallRound(cards, {}, 10);
    expect(round).toHaveLength(10);
    expect(new Set(round.map((c) => c.id)).size).toBe(10);
  });

  it("draws mostly from the learning pool when it's large enough to cover the target share", () => {
    const learningCards = Array.from({ length: 30 }, (_, i) => makeCard(`learning-${i}`));
    const newCards = Array.from({ length: 30 }, (_, i) => makeCard(`new-${i}`));
    const masteredCards = Array.from({ length: 30 }, (_, i) => makeCard(`mastered-${i}`));
    const srsMap: Record<string, SrsEntry> = {};
    for (const card of learningCards) srsMap[card.id] = { box: 1, correctStreak: 1, lastSeenAt: Date.now() };
    for (const card of masteredCards) srsMap[card.id] = { box: 2, correctStreak: 0, lastSeenAt: Date.now() };
    // newCards intentionally absent from srsMap — never attempted.

    const round = buildRecallRound([...learningCards, ...newCards, ...masteredCards], srsMap, 10);
    const learningCount = round.filter((c) => c.id.startsWith("learning-")).length;
    expect(round).toHaveLength(10);
    expect(learningCount).toBe(6); // 60% of 10
  });

  it("backfills from other pools when one pool is empty", () => {
    // Every card is new (no srsMap entries) — the round must still reach the
    // full size by backfilling learning/mastered's share from the new pool.
    const cards = Array.from({ length: 20 }, (_, i) => makeCard(`new-${i}`));
    const round = buildRecallRound(cards, {}, 10);
    expect(round).toHaveLength(10);
  });

  it("gives a different card selection/order across repeated calls on the same pool", () => {
    // Regression check for a real bug report where "the round never changes"
    // turned out to be a stale-round UI bug elsewhere, not a shuffle bug —
    // this asserts the shuffle itself was never the problem and stays that
    // way. A pool this size makes an accidental repeat across 8 runs
    // astronomically unlikely if selection/order is genuinely random.
    const cards = Array.from({ length: 30 }, (_, i) => makeCard(`card-${i}`));
    const runs = Array.from({ length: 8 }, () => buildRecallRound(cards, {}, 10).map((c) => c.id).join(","));
    expect(new Set(runs).size).toBeGreaterThan(1);
  });
});
