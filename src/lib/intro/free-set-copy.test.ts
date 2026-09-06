import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INTRO_STATIC_STATS, introStatsFrom } from "./stats";
import { buildIntroSlides } from "./content";

/**
 * The one sentence outside the deck that also describes the free set — the
 * FAQ answer to "¿Qué obtengo si no me suscribo?" on the home page — must
 * agree with the rules that decide it.
 *
 * It did not. Measured 05.09.2026, both locales said "1 lección, 10
 * tarjetas, 5 modismos, 2 relatos y los primeros crucigramas de nivel A1".
 * Three of those five clauses were wrong: the first lesson of EVERY level
 * is free (four, not one), the free game sample is both types across every
 * level but C1 (83 puzzles, not "the first crosswords of A1"), and the
 * sentence never mentioned the seven free videos or the glossary, which is
 * free in full.
 *
 * The deck itself cannot drift like this any more — it takes every number
 * from src/lib/intro/stats.ts, and scripts/check-intro-numbers.ts proves
 * no number is typed into it. A JSON dictionary cannot import anything, so
 * this test is the equivalent: the numbers stay literals in the file, and
 * the test says which literals they are allowed to be.
 *
 * DELIBERATELY NO DATABASE NUMBERS IN THAT SENTENCE. Free stories and the
 * glossary size are counts, not rules, and a test may not read the bank
 * (`npm run check:no-db-in-tests`). So the copy names them without a
 * number — "los relatos de muestra", "el glosario completo" — and every
 * digit that DOES appear is one this test pins.
 */

const DICTIONARIES = join(process.cwd(), "src", "dictionaries");

function faqFreeAnswer(locale: "es" | "ru"): string {
  const dict = JSON.parse(readFileSync(join(DICTIONARIES, `${locale}.json`), "utf8")) as {
    home: { faq: Array<{ q: string; a: string }> };
  };
  const entry = dict.home.faq.find((item) => /no me suscribo|не подпишусь/.test(item.q));
  expect(entry, `${locale}.json: the "what do I get for free" FAQ entry is gone`).toBeDefined();
  return entry!.a;
}

/** Free-standing digit runs — "A1" and "C1" are level names, not numbers.
 * Same rule as scripts/check-intro-numbers.ts. */
function numbersIn(text: string): number[] {
  return [...text.matchAll(/(?<![\p{L}\d])\d+(?![\p{L}\d])/gu)].map((m) => Number(m[0]));
}

/** Exactly the free-set quantities that are decided by a rule rather than
 * by a row count, so a dictionary sentence may state them. */
const RULE_NUMBERS = [
  INTRO_STATIC_STATS.freeLessons,
  INTRO_STATIC_STATS.lessons,
  10, // FREE_TRIAL_LIMITS.flashcards, restated below through the module
  INTRO_STATIC_STATS.freeWordGamePuzzles,
  INTRO_STATIC_STATS.freeMedia,
];

describe("the free-set sentence in the FAQ", () => {
  const free = introStatsFrom(null).free;

  it("states every rule-decided free quantity, in both locales", () => {
    for (const locale of ["es", "ru"] as const) {
      const text = faqFreeAnswer(locale);
      for (const value of [free.lessons, free.lessonsWithFreeGrammar, free.flashcards, free.idioms, free.wordGamePuzzles, free.media]) {
        expect(numbersIn(text), `${locale}: missing ${value}`).toContain(value);
      }
    }
  });

  it("states no number that is not one of them", () => {
    const allowed = new Set([...RULE_NUMBERS, free.idioms, free.flashcards]);
    for (const locale of ["es", "ru"] as const) {
      for (const value of numbersIn(faqFreeAnswer(locale))) {
        expect(allowed, `${locale}: ${value} is a number nothing in the code decides`).toContain(value);
      }
    }
  });

  /** The control. Both assertions above answer "nothing wrong"; this is
   * the sentence that used to be there, run through the same two checks,
   * and it must fail both — otherwise the checks above prove nothing. */
  it("would have rejected the sentence that was actually shipped", () => {
    const shipped = "El acceso gratuito es permanente: 1 lección, 10 tarjetas, 5 modismos, 2 relatos y los primeros crucigramas de nivel A1.";
    const numbers = numbersIn(shipped);
    expect(numbers).not.toContain(free.lessons);
    expect(numbers).not.toContain(free.wordGamePuzzles);
    const allowed = new Set(RULE_NUMBERS);
    expect(numbers.some((n) => !allowed.has(n))).toBe(true);
  });
});

describe("the deck without a database", () => {
  /** bank: null is not a fallback number, it is "we could not count" — the
   * slides must lose exactly the sentences that needed the bank and keep
   * everything else, rather than printing a zero or a stand-in. */
  it("drops the bank sentences and keeps the rest", () => {
    const withBank = buildIntroSlides(
      introStatsFrom({
        flashcards: 1111,
        stories: 2222,
        freeStories: 3,
        idioms: 3333,
        glossaryTerms: 4444,
        wordSearchPuzzles: 5555,
        crosswordPuzzles: 6666,
      }),
    );
    const withoutBank = buildIntroSlides(introStatsFrom(null));

    expect(withoutBank).toHaveLength(withBank.length);
    const flat = (slides: ReturnType<typeof buildIntroSlides>) =>
      slides.flatMap((s) => [s.title, ...s.body, ...(s.highlights ?? [])]).join("\n");

    expect(flat(withBank)).toContain("1111");
    expect(flat(withoutBank)).not.toContain("1111");
    // The static half survives untouched.
    expect(flat(withoutBank)).toContain(String(INTRO_STATIC_STATS.lessons));
    expect(flat(withoutBank)).toContain(String(INTRO_STATIC_STATS.alphabetLetters));
    expect(flat(withoutBank)).not.toMatch(/\b0 (relatos|tarjetas|modismos)\b/);
  });

  /** "Подмени источник данных — текст слайда обязан измениться": two
   * different banks must produce two different decks, or the numbers are
   * not really coming from the bank. */
  it("changes its text when the counts change", () => {
    const one = buildIntroSlides(
      introStatsFrom({
        flashcards: 10,
        stories: 20,
        freeStories: 1,
        idioms: 30,
        glossaryTerms: 40,
        wordSearchPuzzles: 50,
        crosswordPuzzles: 60,
      }),
    );
    const two = buildIntroSlides(
      introStatsFrom({
        flashcards: 11,
        stories: 21,
        freeStories: 2,
        idioms: 31,
        glossaryTerms: 41,
        wordSearchPuzzles: 51,
        crosswordPuzzles: 61,
      }),
    );
    expect(JSON.stringify(one)).not.toEqual(JSON.stringify(two));
    const inside = (slides: ReturnType<typeof buildIntroSlides>) =>
      slides.find((s) => s.id === "intro-9-inside")!.body.join(" ");
    expect(inside(one)).not.toEqual(inside(two));
  });
});
