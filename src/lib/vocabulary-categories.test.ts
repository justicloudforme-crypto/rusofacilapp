import { describe, expect, it } from "vitest";
import { flashcardCategories } from "./flashcards/types";
import {
  PUBLIC_VOCABULARY_LEVELS,
  VOCABULARY_CATEGORY_PAGES,
  getVocabularyCategoryPage,
} from "./vocabulary-categories";

describe("public vocabulary category pages", () => {
  it("covers every flashcard category exactly once", () => {
    expect([...VOCABULARY_CATEGORY_PAGES.map((p) => p.category)].sort()).toEqual(
      [...flashcardCategories].sort(),
    );
  });

  it("never publishes C1", () => {
    // 898 C1 cards stay behind the paywall in full. This is the one
    // property of these pages that is a product decision rather than a
    // presentation choice, so it gets its own assertion.
    expect(PUBLIC_VOCABULARY_LEVELS).toEqual(["A1", "A2", "B1", "B2"]);
    expect(PUBLIC_VOCABULARY_LEVELS).not.toContain("C1");
  });

  it("has unique slugs that are URL-safe and not the internal category key", () => {
    const slugs = VOCABULARY_CATEGORY_PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      expect(page.slug, page.slug).toMatch(/^[a-z0-9-]+$/);
      expect(page.slug, page.slug).not.toBe(page.category);
    }
  });

  it("keeps every intro inside the agreed 150–250 words", () => {
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      const words = page.intro.join(" ").split(/\s+/).filter(Boolean).length;
      expect(words, page.slug).toBeGreaterThanOrEqual(150);
      expect(words, page.slug).toBeLessThanOrEqual(250);
    }
  });

  it("writes a genuinely different intro per category, not a filled-in template", () => {
    // The failure mode this guards is one shared paragraph with the
    // category name substituted in, which would recreate the thin-page
    // problem these pages exist to fix. Two cheap proxies: no first
    // sentence may repeat, and no long sentence may appear on two pages.
    const openings = VOCABULARY_CATEGORY_PAGES.map((p) => p.intro[0].split(".")[0]);
    expect(new Set(openings).size).toBe(openings.length);

    const seen = new Map<string, string>();
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      for (const sentence of page.intro.join(" ").split(/(?<=\.)\s+/)) {
        const key = sentence.trim();
        if (key.length < 60) continue;
        expect(seen.has(key), `${key.slice(0, 50)}… repeated on ${seen.get(key)}`).toBe(false);
        seen.set(key, page.slug);
      }
    }
  });

  it("never mixes Latin and Cyrillic inside one word", () => {
    // The intros quote Russian inline, so this is the same guard the
    // glossary seed data and the cultural notes carry.
    const mixed: string[] = [];
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      for (const word of [page.h1, page.metaTitle, page.metaDescription, ...page.intro]
        .join(" ")
        .split(/[^\p{L}]+/u)) {
        if (/[А-Яа-яЁё]/.test(word) && /[A-Za-z]/.test(word)) mixed.push(`${page.slug}: ${word}`);
      }
    }
    expect(mixed).toEqual([]);
  });

  it("resolves a slug and rejects an unknown one", () => {
    expect(getVocabularyCategoryPage("comida")?.category).toBe("food");
    expect(getVocabularyCategoryPage("food")).toBeUndefined();
    expect(getVocabularyCategoryPage("no-existe")).toBeUndefined();
  });

  it("keeps every title short enough to survive Google's SERP truncation", () => {
    // Measured on the live pages 28.08.2026: 12 of the 23 titles were
    // 71–79 characters, so the part that carries the query ("vocabulario
    // ruso de política") survived but the tail was cut mid-phrase in the
    // result snippet. Google truncates on pixel width, not characters —
    // ~70 characters is the usual safe ceiling for Spanish, and the fixed
    // " | RusoFácilapp" suffix already eats 15 of them.
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      expect(page.metaTitle.length, `${page.slug}: ${page.metaTitle}`).toBeLessThanOrEqual(70);
    }
    // Descriptions were already inside the ~155-character display limit
    // (measured min 113 / max 150); assert it so they stay there.
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      expect(page.metaDescription.length, page.slug).toBeLessThanOrEqual(155);
      expect(page.metaDescription.length, page.slug).toBeGreaterThanOrEqual(70);
    }
    // Distinct titles are what keep 23 sibling pages from looking like one
    // page to a crawler — the whole reason they exist separately.
    expect(new Set(VOCABULARY_CATEGORY_PAGES.map((p) => p.metaTitle)).size).toBe(
      VOCABULARY_CATEGORY_PAGES.length,
    );
    expect(new Set(VOCABULARY_CATEGORY_PAGES.map((p) => p.metaDescription)).size).toBe(
      VOCABULARY_CATEGORY_PAGES.length,
    );
  });

  it("splits titles by intent — a word list, not a definition or a lesson", () => {
    // Point of the split: the glossary answers "what does this term mean",
    // a lesson answers "how do I use it", these answer "which words".
    for (const page of VOCABULARY_CATEGORY_PAGES) {
      expect(page.h1, page.slug).toMatch(/Vocabulario|Palabras|Saludos|Verbos|Sinónimos/);
      expect(page.metaDescription.toLowerCase(), page.slug).toMatch(
        /palabras|lista|vocabulario|pares/,
      );
    }
  });
});
