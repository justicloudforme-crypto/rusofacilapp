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
import { FREE_RUNGS_PER_LADDER, topicForPuzzle } from "./topics";

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
          // The topic a real row would carry at this coordinate — so every
          // check below runs over the themed titles too, not just the
          // mixed ones. topicForPuzzle returns null for every paid rung.
          yield { lang, type, level, sequence, wordCount, topic: topicForPuzzle(type, level, sequence) };
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
      const title = puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic);
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
      const description = puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic);
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
      titles.add(puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic));
      descriptions.add(puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic));
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
      ...[...coordinates()].map((c) => puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic)),
    ];
    for (const title of ours) expect(landing, title).not.toContain(title);
  });

  it("names the topic when the row has one", () => {
    expect(puzzleTitle("es", "WORD_SEARCH", "A2", 9, 24, "comida")).toBe(
      "Sopa de letras de comida en ruso (A2) | RusoFácilapp",
    );
    expect(puzzleTitle("ru", "CROSSWORD", "B1", 10, 24, "comida")).toBe(
      "Кроссворд на русском: еда (B1) | RusoFácilapp",
    );
    expect(puzzleDescription("es", "WORD_SEARCH", "A2", 9, 24, "comida")).toContain("24 palabras de comida");
  });

  it("follows the row, not the lookup table", () => {
    // A2 rung 9 IS themed in topics.ts. If the stored row ever comes back
    // without a topic — a rerun where the category no longer fills that
    // length band — the page must stop claiming a theme instead of
    // captioning words it does not have.
    expect(topicForPuzzle("WORD_SEARCH", "A2", 9)).toBe("comida");
    const asStoredMixed = puzzleTitle("es", "WORD_SEARCH", "A2", 9, 24, null);
    expect(asStoredMixed).not.toContain("comida");
    expect(asStoredMixed).toContain("nº 9");
  });

  it("leaves the untheme-able rungs' titles exactly as they were", () => {
    // 11 rungs still draw from the mixed pool. Their titles are the ones
    // already live and indexed; this change must not disturb them.
    expect(topicForPuzzle("WORD_SEARCH", "A1", 10)).toBeNull();
    expect(puzzleTitle("es", "WORD_SEARCH", "A1", 10, 26, topicForPuzzle("WORD_SEARCH", "A1", 10))).toBe(
      "Sopa de letras en ruso, nivel A1 nº 10 (26 palabras) | RusoFácilapp",
    );
    expect(puzzleDescription("ru", "CROSSWORD", "B2", 9, 22, topicForPuzzle("CROSSWORD", "B2", 9))).toBe(
      "Кроссворд по русскому языку уровня B2: 22 определений на испанском, ответы кириллицей. Головоломка № 9, бесплатно и без регистрации.",
    );
  });

  it("positive control: an unknown topic falls back instead of inventing a label", () => {
    // Guards the branch itself. A slug with no entry in TOPIC_LABELS must
    // produce the mixed title, never "Sopa de letras de no-such-thing".
    const title = puzzleTitle("es", "WORD_SEARCH", "A2", 9, 24, "no-such-category");
    expect(title).toBe("Sopa de letras en ruso, nivel A2 nº 9 (24 palabras) | RusoFácilapp");
  });

  it("every themed rung really is inside every ceiling", () => {
    // The generic loops above cover this too, but only because
    // coordinates() reads the table. Asserting the count separately means
    // a table that silently emptied itself cannot make those loops pass
    // vacuously.
    let checked = 0;
    for (const c of coordinates()) {
      if (!c.topic) continue;
      const title = puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic);
      const description = puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic);
      expect(title.length, title).toBeLessThanOrEqual(TITLE_MAX);
      expect(description.length, description).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(description.length, description).toBeLessThanOrEqual(DESCRIPTION_MAX);
      checked++;
    }
    // 69 themed rungs x 2 locales
    expect(checked).toBe(69 * locales.length);
    expect(FREE_RUNGS_PER_LADDER).toBe(10);
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    // Standing check for anything written in both scripts. Level codes
    // (A1, B2) are Latin tokens on their own and are not affected.
    const mixed: string[] = [];
    const texts = [
      ...locales.flatMap((lang) => [hubMetadata(lang).title, hubMetadata(lang).description]),
      ...[...coordinates()].flatMap((c) => [
        puzzleTitle(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic),
        puzzleDescription(c.lang, c.type, c.level, c.sequence, c.wordCount, c.topic),
      ]),
    ];
    for (const word of texts.join(" ").split(/[^\p{L}]+/u)) {
      if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.push(word);
    }
    expect([...new Set(mixed)]).toEqual([]);
  });
});
