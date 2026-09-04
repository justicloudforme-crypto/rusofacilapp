import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { flashcardLevels } from "@/lib/flashcards/types";
import { wordGameTypes } from "./types";
import {
  EXTRA_FREE_WORD_GAME_RUNGS,
  WORD_GAME_FREE_RUNGS_PER_LEVEL,
  freeSequencesFor,
  isFreeWordGamePuzzle,
  isPubliclyOpenableWordGamePuzzle,
} from "./free-tier";
import robots from "@/app/robots";
import { topicForPuzzle } from "./topics";

/**
 * Four separate places decide which word-game puzzles are free, and they
 * have to mean the same 80 URLs:
 *
 *   1. isFreeWordGamePuzzle — the paywall redirect on the puzzle page and
 *      in every /api/word-games route;
 *   2. src/app/sitemap.ts   — which puzzle URLs are submitted to Google;
 *   3. src/app/robots.ts    — the anchored `Allow:` lines that re-open
 *      those URLs under the blanket `Disallow: /*​/word-games/`;
 *   4. word-games/topics.ts — which rungs the generator may re-theme.
 *
 * They already share a constant, which is why this file checks the thing
 * a shared constant does NOT protect: that each place still applies it to
 * the same levels, the same types and the same rung range. A sitemap
 * listing a puzzle the paywall redirects away is a soft 404 in Search
 * Console; a robots line opening one the sitemap omits is crawl budget
 * spent on a redirect.
 */

const APP = join(process.cwd(), "src", "app");
const sitemapSource = readFileSync(join(APP, "sitemap.ts"), "utf8");
const robotsSource = readFileSync(join(APP, "robots.ts"), "utf8");

/** Every (type, level, sequence) the paywall treats as free. */
function freeCoordinates() {
  const out: Array<{ type: string; level: string; sequence: number }> = [];
  for (const type of wordGameTypes) {
    for (const level of flashcardLevels) {
      // 700, а не 40: бесплатным может быть не только номер из первого
      // десятка (EXTRA_FREE_WORD_GAME_RUNGS), и диапазон, обрывающийся
      // раньше самой длинной лестницы банка (B1 — 669), пропустил бы
      // ровно те координаты, ради которых список и заведён.
      for (let sequence = 1; sequence <= 700; sequence++) {
        if (isFreeWordGamePuzzle({ type, level, sequence })) out.push({ type, level, sequence });
      }
    }
  }
  return out;
}

describe("the free word-game tier means the same 80 URLs everywhere", () => {
  const free = freeCoordinates();

  it("is 80 puzzles by number, plus whatever is free by name", () => {
    expect(free.length).toBe(80 + EXTRA_FREE_WORD_GAME_RUNGS.length);
    expect(new Set(free.map((c) => c.level))).toEqual(new Set(["A1", "A2", "B1", "B2"]));
    expect(new Set(free.map((c) => c.type))).toEqual(new Set(["WORD_SEARCH", "CROSSWORD"]));
    // Правило по номеру не двинулось: за десяткой бесплатны РОВНО те
    // координаты, что перечислены поимённо, и ни одной больше.
    const byNumber = free.filter((c) => c.sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL);
    expect(byNumber).toHaveLength(80);
    const byName = free.filter((c) => c.sequence > WORD_GAME_FREE_RUNGS_PER_LEVEL);
    expect(byName.map((c) => `${c.type}/${c.level}/${c.sequence}`).sort()).toEqual(
      EXTRA_FREE_WORD_GAME_RUNGS.map((r) => `${r.type}/${r.level}/${r.sequence}`).sort(),
    );
    // И каждый перечисленный обязан пройти само правило — список,
    // который правило не признаёт, открыл бы страницу только на одной
    // поверхности из четырёх.
    for (const r of EXTRA_FREE_WORD_GAME_RUNGS) {
      expect(isFreeWordGamePuzzle(r), `${r.type}/${r.level}/${r.sequence}`).toBe(true);
    }
  });

  it("freeSequencesFor answers exactly what the paywall rule answers", () => {
    // Единственный признак бесплатности на всех поверхностях — эта пара.
    // Просеиваются номера ЗАВЕДОМО шире любого предела и любого хвоста,
    // иначе согласие проверялось бы только там, где ответ и так «нет».
    for (const type of [...wordGameTypes, "STORY"]) {
      for (const level of flashcardLevels) {
        const listed = new Set(freeSequencesFor(type, level));
        for (let sequence = 1; sequence <= 700; sequence += 1) {
          expect(
            listed.has(sequence),
            `${type}/${level}/${sequence}: freeSequencesFor и isFreeWordGamePuzzle разошлись`,
          ).toBe(isFreeWordGamePuzzle({ type, level, sequence }));
        }
      }
    }
  });

  it("sitemap.ts derives its puzzle URLs from that rule and restates none of it", () => {
    // Read as text: importing sitemap.ts pulls in the database client, and
    // this has to run in the unit suite with no Turso.
    expect(sitemapSource).toContain("freeSequencesFor(type, level)");
    expect(sitemapSource).toContain("freeWordGameWhere()");
    // И ни одного пересказа правила рядом: ни предела номером, ни
    // отдельного отсева C1 — оба уже внутри правила.
    expect(sitemapSource).not.toMatch(/sequence <= 10\b/);
    expect(sitemapSource).not.toContain("wordGamePuzzlesPerLevel");
    expect(sitemapSource).not.toMatch(/l !== "C1"/);
  });

  it("robots.ts opens exactly the free coordinates and no others", () => {
    // Не текстом, а вызовом: robots.ts не трогает базу, поэтому его можно
    // просто выполнить и сравнить выданные Allow с ответом правила.
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = ([] as string[]).concat(rule.allow ?? []);
    const puzzleAllow = allow.filter((a) => a.includes("/word-games/"));
    expect([...puzzleAllow].sort()).toEqual(
      free.map((c) => `/*/word-games/${c.type}/${c.level}/${c.sequence}$`).sort(),
    );
    // Якорь `$` — это то, что не даёт /A1/1 открыть заодно /A1/10.
    expect(puzzleAllow.every((a) => a.endsWith("$"))).toBe(true);
    expect(robotsSource).toContain("freeSequencesFor(type, level)");
    expect(robotsSource).not.toMatch(/level !== "C1"/);
  });

  it("control: robots.ts would notice a rule that opened one rung too many", () => {
    // Позитивный контроль к сравнению выше: если бы robots.ts крутил
    // `length: LIMIT + 1`, вот чем бы это отличалось. Без этого равенство
    // могло бы держаться на том, что обе стороны считаются одинаково
    // неправильно.
    const drifted = free
      .map((c) => `/*/word-games/${c.type}/${c.level}/${c.sequence}$`)
      .concat("/*/word-games/WORD_SEARCH/A1/11$");
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const allow = ([] as string[]).concat(rule.allow ?? []).filter((a) => a.includes("/word-games/"));
    expect([...drifted].sort()).not.toEqual([...allow].sort());
  });

  it("never themes a puzzle the paywall would redirect away", () => {
    // A themed title on a locked puzzle would be a promise shown to a
    // crawler and refused to the visitor who clicked it.
    for (const type of wordGameTypes) {
      for (const level of flashcardLevels) {
        for (let sequence = 1; sequence <= 40; sequence++) {
          if (topicForPuzzle(type, level, sequence) === null) continue;
          expect(isFreeWordGamePuzzle({ type, level, sequence }), `${type}/${level}/${sequence}`).toBe(true);
        }
      }
    }
  });

  it("positive control: the checks above notice a rule that drifted", () => {
    // If the three places disagreed, this is the shape it would take —
    // one of them capping at a different rung, or including C1. Asserted
    // against a deliberately wrong local rule so the passing checks above
    // cannot be passing because the comparison is inert.
    const drifted = (p: { type: string; level: string; sequence: number }) =>
      (p.type === "WORD_SEARCH" || p.type === "CROSSWORD") && p.sequence <= WORD_GAME_FREE_RUNGS_PER_LEVEL;
    const driftedCount = [...wordGameTypes].flatMap((type) =>
      [...flashcardLevels].flatMap((level) =>
        Array.from({ length: 40 }, (_, i) => i + 1).filter((sequence) => drifted({ type, level, sequence })),
      ),
    ).length;
    expect(driftedCount).toBe(100);
    expect(driftedCount).not.toBe(free.length);
  });
});

describe("isPubliclyOpenableWordGamePuzzle", () => {
  const base = { type: "WORD_SEARCH", level: "A1", sequence: 2 };

  it("accepts an ordinary free rung", () => {
    expect(isPubliclyOpenableWordGamePuzzle({ ...base, curved: false, premiumOnly: false })).toBe(true);
    expect(isPubliclyOpenableWordGamePuzzle(base)).toBe(true);
  });

  it("refuses a free rung that the SECOND gate closes", () => {
    // The puzzle page's own order: isFreeWordGamePuzzle first, then
    // `(curved || premiumOnly) && !canAccessCurvedPuzzle(tier)`, and that
    // second one is Premium-only. Both of these answer an anonymous
    // visitor with a 307 into /pricing.
    expect(isPubliclyOpenableWordGamePuzzle({ ...base, curved: true })).toBe(false);
    expect(isPubliclyOpenableWordGamePuzzle({ ...base, premiumOnly: true })).toBe(false);
    expect(isPubliclyOpenableWordGamePuzzle({ ...base, curved: true, premiumOnly: true })).toBe(false);
  });

  it("still refuses what the first rule refuses, flags or no flags", () => {
    expect(isPubliclyOpenableWordGamePuzzle({ type: "WORD_SEARCH", level: "C1", sequence: 1 })).toBe(false);
    expect(isPubliclyOpenableWordGamePuzzle({ type: "WORD_SEARCH", level: "A1", sequence: 11 })).toBe(false);
  });

  /**
   * Positive control: the rule this replaced — free-by-rule alone — must
   * be visibly different on the exact row the e2e fixture holds. Without
   * this the three tests above could be passing on a function that
   * ignores the flags entirely, which is precisely what shipped.
   */
  it("control: the free rule alone really does disagree, on the real row that exposed it", () => {
    const fixtureStar = { type: "WORD_SEARCH", level: "A1", sequence: 2, curved: true, premiumOnly: true };
    expect(isFreeWordGamePuzzle(fixtureStar)).toBe(true);
    expect(isPubliclyOpenableWordGamePuzzle(fixtureStar)).toBe(false);
  });
});
