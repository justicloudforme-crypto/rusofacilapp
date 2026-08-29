import { describe, expect, it } from "vitest";
import { locales } from "@/i18n/config";
import { flashcardLevels } from "@/lib/flashcards/types";
import { wordGameTypes } from "./types";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
  hubMetadata,
  puzzleDescription,
  puzzleTitle,
} from "./metadata";

/** Every coordinate a puzzle page can be reached at, with room to spare:
 * the ladder runs to ~26 rungs per (type, level) today and word counts to
 * 26, so 40 rungs and 60 words covers a regenerated, longer ladder too. A
 * title that only fits the puzzles that happen to exist right now would
 * quietly break the day the generator is re-run. */
function* coordinates() {
  for (const lang of locales) {
    for (const type of wordGameTypes) {
      for (const level of flashcardLevels) {
        for (let sequence = 1; sequence <= 40; sequence++) {
          const wordCount = (type === "WORD_SEARCH" ? 8 : 6) + 2 * Math.min(sequence, 27);
          yield { lang, type, level, sequence, wordCount };
        }
      }
    }
  }
}

describe("word-game page metadata", () => {
  it("keeps every title inside the SERP ceiling", () => {
    // The failure this exists for: before 29.08.2026 these pages had no
    // title of their own at all and inherited the home page's. Replacing
    // that with a title Google then cuts in half would only be a different
    // kind of broken.
    for (const c of coordinates()) {
      const title = puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount);
      expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
      expect(title.endsWith(" | RusoFácilapp"), title).toBe(true);
    }
    for (const lang of locales) {
      const { title } = hubMetadata(lang);
      expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
    }
  });

  it("keeps every description inside the snippet range", () => {
    for (const c of coordinates()) {
      const description = puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount);
      expect(description.length, description).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
    for (const lang of locales) {
      const { description } = hubMetadata(lang);
      expect(description.length, description).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it("gives every puzzle a title and a description no other puzzle has", () => {
    // 160 sibling URLs that all say the same thing is exactly the state
    // this replaced; uniqueness is the point, not a nicety.
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    let count = 0;
    for (const c of coordinates()) {
      titles.add(puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount));
      descriptions.add(puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount));
      count++;
    }
    for (const lang of locales) {
      titles.add(hubMetadata(lang).title);
      descriptions.add(hubMetadata(lang).description);
    }
    expect(titles.size).toBe(count + locales.length);
    expect(descriptions.size).toBe(count + locales.length);
  });

  it("says the puzzle's real word count, not the rung number", () => {
    // The word count is read from the stored row, so a regenerated ladder
    // cannot leave the titles describing puzzles that no longer exist.
    // Guards against someone "simplifying" it back to a formula on
    // sequence, which is what the current generator happens to produce.
    expect(puzzleTitle("es", "WORD_SEARCH", "A1", 3, 12)).toContain("(12 palabras)");
    expect(puzzleTitle("es", "WORD_SEARCH", "A1", 3, 9)).toContain("(9 palabras)");
    expect(puzzleTitle("ru", "CROSSWORD", "B2", 7, 18)).toContain("(18 слов)");
  });

  it("does not collide with the two single-puzzle landing pages", () => {
    // /es/sopa-de-letras-ruso and /es/crucigramas-ruso-principiantes exist
    // to win exactly those two queries. The hub is the ladder, so it says
    // "por niveles" instead of competing for the same phrase.
    const landing = [
      "Sopa de letras en ruso, gratis y sin registro | RusoFácilapp",
      "Crucigrama de ruso para principiantes, gratis | RusoFácilapp",
      "Sopa de letras del alfabeto cirílico | RusoFácilapp",
      "Juegos para aprender ruso, gratis y sin registro | RusoFácilapp",
    ];
    const ours = [
      hubMetadata("es").title,
      hubMetadata("ru").title,
      ...[...coordinates()].map((c) => puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount)),
    ];
    for (const title of ours) expect(landing, title).not.toContain(title);
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    // Standing check for anything written in both scripts. Level codes
    // (A1, B2) are Latin tokens on their own and are not affected.
    const mixed: string[] = [];
    const texts = [
      ...locales.flatMap((lang) => [hubMetadata(lang).title, hubMetadata(lang).description]),
      ...[...coordinates()].flatMap((c) => [
        puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount),
        puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount),
      ]),
    ];
    for (const word of texts.join(" ").split(/[^\p{L}]+/u)) {
      if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.push(word);
    }
    expect([...new Set(mixed)]).toEqual([]);
  });
});
