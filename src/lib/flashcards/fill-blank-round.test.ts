import { describe, expect, it } from "vitest";
import { buildFillBlankRound, findWholeWordSpan, getBlankedSentence, hasFillBlankSentence } from "./fill-blank-round";
import type { FlashcardRow } from "./index";

function makeCard(id: string, russian: string, exampleRu: string): FlashcardRow {
  return {
    id,
    category: "food",
    level: "A1",
    emoji: "🍎",
    russian,
    transcription: id,
    translationEs: id,
    exampleRu,
    exampleEs: "",
    synonyms: [],
    antonyms: [],
  };
}

describe("findWholeWordSpan", () => {
  it("finds a clean whole-word match", () => {
    const span = findWholeWordSpan("У меня есть собака.", "собака");
    expect(span).toEqual({ start: 12, end: 18 });
  });

  it("is case-insensitive", () => {
    const span = findWholeWordSpan("Собака бежит.", "собака");
    expect(span).toEqual({ start: 0, end: 6 });
  });

  it("does not match a word that's only a substring of a longer inflected word", () => {
    // "холодильник" is a substring of "холодильнике" but not the whole word —
    // this is exactly the inflection problem the whole-word check exists for.
    expect(findWholeWordSpan("В холодильнике нет еды.", "холодильник")).toBeNull();
  });

  it("returns null when the word isn't present at all", () => {
    expect(findWholeWordSpan("Это другое предложение.", "собака")).toBeNull();
  });
});

describe("getBlankedSentence / hasFillBlankSentence", () => {
  it("splits the sentence around the matched word", () => {
    const card = makeCard("a", "собака", "У меня есть собака.");
    expect(getBlankedSentence(card)).toEqual({ before: "У меня есть ", after: "." });
    expect(hasFillBlankSentence(card)).toBe(true);
  });

  it("reports ineligible when the sentence only has an inflected form", () => {
    const card = makeCard("a", "холодильник", "В холодильнике нет еды.");
    expect(getBlankedSentence(card)).toBeNull();
    expect(hasFillBlankSentence(card)).toBe(false);
  });
});

describe("buildFillBlankRound", () => {
  it("only draws from cards with a blankable sentence", () => {
    const eligible = Array.from({ length: 5 }, (_, i) => makeCard(`ok-${i}`, `слово${i}`, `Это слово${i} тут.`));
    const ineligible = [makeCard("bad", "холодильник", "В холодильнике нет еды.")];
    const round = buildFillBlankRound([...eligible, ...ineligible], {}, 10);
    expect(round.every((c) => c.id !== "bad")).toBe(true);
    expect(round).toHaveLength(5);
  });
});
