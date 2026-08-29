import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One database read must not be able to take down a whole page.
 *
 * The 29.08.2026 outage in one sentence: sitemap.ts selected a column that
 * did not exist in production, the query threw, and /sitemap.xml returned
 * HTTP 500 — so a sitemap that had nothing to do with that column became
 * invisible to every crawler. The column was the trigger; the design
 * defect was that a single read could fail the entire response.
 *
 * sitemap.ts was fixed and pinned (crawlable-surface.test.ts). This file
 * extends the same rule to the pages with the SAME shape — a crawler-facing
 * page whose content is already in hand, ruined by a secondary read that
 * only decorates it — and, just as importantly, pins the reads that must
 * KEEP failing loudly, so a later pass does not "helpfully" wrap them.
 *
 * Granularity is one function, not one file, because the same file mixes
 * both kinds: word-games/data.ts serves a puzzle's own grid (content, must
 * throw), a ★ badge (decoration, must degrade) and the paywall's rung list
 * (must fail closed) from three adjacent queries.
 */

const SRC = join(process.cwd(), "src");

/** Byte ranges covered by a `try { … }` block, found by counting braces
 * rather than by regex: a `}` inside a string or a comment ends a naive
 * `[^}]*` match early, which is the exact mistake that made
 * ensure-schema-sync.ts blind to 25 production columns. */
function tryRanges(rawSource: string): Array<[number, number]> {
  const source = withoutComments(rawSource);
  const ranges: Array<[number, number]> = [];
  const header = /\btry\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = header.exec(source))) {
    let depth = 1;
    let i = header.lastIndex;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    ranges.push([match.index, i]);
  }
  return ranges;
}

/**
 * The source of one top-level declaration: from its `export function` /
 * `export const` / `function` line up to the start of the next top-level
 * declaration (or end of file).
 *
 * Deliberately NOT "find the first `{` and count braces". A signature can
 * open a brace before the body does — `Promise<Map<string, Array<{ type:
 * WordGameType … }>>>` is a real return type in word-games/data.ts — and a
 * body brace can sit inside a call, as in `export const f = cache(async ()
 * => {`. Both break brace counting from the first `{`; column-0 boundaries
 * do not care about either.
 */
function symbolBody(source: string, symbol: string): string {
  const decl = new RegExp(`^(export\\s+)?(async\\s+)?(function|const)\\s+${symbol}\\b`, "m");
  const start = source.search(decl);
  if (start === -1) throw new Error(`symbol not found: ${symbol}`);
  const rest = source.slice(start + 1);
  const next = rest.search(/^(export |function |const |async function |\/\*\*)/m);
  return next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
}

/**
 * Helpers that reach the database without the caller ever naming `db`.
 * A scanner that only knows `db.` calls reports "no reads here" for a
 * function whose every read is indirect, and the assertion then passes for
 * the wrong reason — which is what happened to getHomepageWordSample and
 * getHomepagePreviewData on the first run of this file.
 *
 * Each entry is checked below to be a real exported symbol, so a rename
 * cannot quietly empty this list.
 */
const DB_BACKED_HELPERS: Array<{ name: string; definedIn: string }> = [
  { name: "getFlashcardIndex", definedIn: "lib/flashcards/cache.ts" },
  { name: "getStoryCatalog", definedIn: "lib/stories-catalog.ts" },
  { name: "attachGlossaryAudio", definedIn: "lib/glossary-audio.ts" },
];

/**
 * Blanks out comments, preserving every byte position so offsets still
 * line up with the original text.
 *
 * Needed because these files explain themselves at length and the prose
 * quotes the code: sitemap.ts's header says "so db.story.findMany() below
 * hit a real prod deploy failure", and a scanner that reads comments
 * reported that sentence as an unguarded read.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Every query, with or without a directly attached `await`.
 *
 * Matching `await db.` alone was not enough and the omission was live:
 * getThemedPuzzlesByTopic passes its query as a callback to `cached(...)`,
 * so the `await` sits on the cache wrapper and the read itself reads
 * `db.wordGamePuzzle.findMany({`. A scanner that misses that shape reports
 * "no reads here" and the assertion passes for the wrong reason — which is
 * exactly what it did on the first run of this file. */
function readOffsets(rawSource: string): Array<{ offset: number; model: string }> {
  const source = withoutComments(rawSource);
  const direct = [
    ...source.matchAll(/\bdb\.(\w+)\.(findMany|findUnique|findFirst|count|aggregate|groupBy)\(/g),
  ].map((m) => ({ offset: m.index!, model: m[1] }));
  const indirect = DB_BACKED_HELPERS.flatMap(({ name }) =>
    [...source.matchAll(new RegExp(`\\b${name}\\(`, "g"))].map((m) => ({ offset: m.index!, model: name })),
  );
  return [...direct, ...indirect].sort((a, b) => a.offset - b.offset);
}

function unguardedReads(source: string): string[] {
  const ranges = tryRanges(source);
  return readOffsets(source)
    .filter(({ offset }) => !ranges.some(([start, end]) => offset > start && offset < end))
    .map(({ model }) => model);
}

/**
 * Reads that must degrade, and what each failure is allowed to cost. The
 * cost is written down because "wrap it" without "and then what does the
 * visitor see" is how a page ends up serving a confident `0 palabras`.
 */
/** `model` narrows the rule to one query inside the symbol. Some functions
 * legitimately mix both kinds: fetchFlashcardIndex reads the card bank
 * (content — must throw) and joins narration URLs (decoration — must
 * degrade) two lines apart. */
const MUST_DEGRADE: Array<{ where: string; file: string; symbol: string | null; model?: string; cost: string }> = [
  {
    where: "sitemap.ts (all three reads)",
    file: "app/sitemap.ts",
    symbol: null,
    cost: "that family's URLs are missing; the other ~1250 still ship",
  },
  {
    where: "attachGlossaryAudio",
    file: "lib/glossary-audio.ts",
    symbol: "attachGlossaryAudio",
    cost: "236 glossary URLs render without the play button, definitions intact",
  },
  {
    where: "getHomepageStats",
    file: "lib/home-stats.ts",
    symbol: "getHomepageStats",
    cost: "/es and /ru drop two trust-strip numbers, keeping copy, links and JSON-LD",
  },
  {
    where: "getHomepageWordSample",
    file: "lib/home-stats.ts",
    symbol: "getHomepageWordSample",
    cost: "the hero deck disappears; the page already guards on words.length",
  },
  {
    where: "getHomepagePreviewData",
    file: "lib/home-stats.ts",
    symbol: "getHomepagePreviewData",
    cost: "the three preview cards disappear; each is already null-guarded",
  },
  {
    where: "fetchFlashcardIndex (the narration join only)",
    file: "lib/flashcards/cache.ts",
    symbol: "fetchFlashcardIndex",
    model: "audioAsset",
    cost: "the whole card bank keeps working with audioUrl null; SpeakButton falls back to speechSynthesis",
  },
  {
    where: "getThemedPuzzlesByTopic",
    file: "lib/word-games/data.ts",
    symbol: "getThemedPuzzlesByTopic",
    cost: "23 vocabulary pages and 6 landings drop the puzzle link block",
  },
  {
    where: "getAllCurvedSequences",
    file: "lib/word-games/data.ts",
    symbol: "getAllCurvedSequences",
    cost: "/es|ru/word-games loses ★ badges but keeps all 196 puzzle links",
  },
];

/**
 * Reads that must KEEP throwing, and why. Asserted, not just documented —
 * wrapping any of these would be a regression with no visible symptom.
 */
const MUST_FAIL_LOUDLY: Array<{ where: string; file: string; symbol: string; why: string }> = [
  {
    where: "getAllPremiumOnlySequences",
    file: "lib/word-games/data.ts",
    symbol: "getAllPremiumOnlySequences",
    why: "an empty map would present every paid rung as free — a read that decides what is behind the paywall fails closed",
  },
  {
    where: "getPuzzle",
    file: "lib/word-games/data.ts",
    symbol: "getPuzzle",
    why: "the grid IS the puzzle page — there is nothing left to render once the row cannot be read, so 500 is the honest answer",
  },
  {
    where: "getLandingPuzzleForTopic",
    file: "lib/word-games/data.ts",
    symbol: "getLandingPuzzleForTopic",
    why: "the themed landing's whole premise is its puzzle — it already 404s when the theme has none rather than embed an unrelated grid",
  },
  {
    where: "countAllSequences",
    file: "lib/word-games/data.ts",
    symbol: "countAllSequences",
    why: "this is the picker's content, not its decoration — degrading it would serve a hub with no puzzles on it",
  },
  {
    where: "protectAdminRoute",
    file: "proxy.ts",
    symbol: "protectAdminRoute",
    why: "the read IS the authorisation check — swallowing its error and continuing would admit an unauthenticated request to /admin",
  },
];

/**
 * Not asserted, because the reason is the artefact and a mechanical check
 * would fight anyone who later finds a better answer.
 */
const LEFT_ALONE_ON_PURPOSE = {
  "glossary/[slug] getTermBySlug, stories/[id]":
    "the read is the page's content. A page that cannot load what it exists " +
    "to show has nothing to degrade to; 500 is the honest answer.",
  "api/* route handlers":
    "each response is already its own unit of failure and its caller can " +
    "retry. A 500 there costs one endpoint, not a page of content.",
  "lib/content-links.ts (story insights)":
    "that block is the measured variable of the live experiment on 165 frozen " +
    "pages until 25.09.2026. Touching when it renders — even only on the " +
    "failure path — touches the measurement. Revisit after the freeze.",
} as const;

describe("a single database read cannot take down a page", () => {
  it.each(MUST_DEGRADE)("$where degrades instead of throwing", ({ file, symbol, model }) => {
    const whole = readFileSync(join(SRC, file), "utf8");
    const source = symbol ? symbolBody(whole, symbol) : whole;
    const relevant = (models: string[]) => (model ? models.filter((m) => m === model) : models);
    expect(
      relevant(readOffsets(source).map((r) => r.model)).length,
      `${file}: no ${model ?? "db"} read found — has it moved or been renamed?`,
    ).toBeGreaterThan(0);
    expect(relevant(unguardedReads(source)), `${file}: read outside any try block`).toEqual([]);
    expect(source, `${file}: catches but does not log`).toMatch(/catch\s*\([^)]*\)\s*\{[\s\S]*?console\.error\(/);
  });

  it.each(MUST_FAIL_LOUDLY)("$where still fails loudly, on purpose", ({ file, symbol }) => {
    const source = symbolBody(readFileSync(join(SRC, file), "utf8"), symbol);
    expect(readOffsets(source).length, `${symbol}: no db read found`).toBeGreaterThan(0);
    expect(
      unguardedReads(source).length,
      `${symbol} was wrapped in try/catch — read MUST_FAIL_LOUDLY in this file before changing that`,
    ).toBeGreaterThan(0);
  });

  it("positive control: narrowing to a model cannot pass by matching nothing", () => {
    // `model` exists so one query inside a function can be required to
    // degrade while its neighbour stays bare. That would be a loophole if a
    // typo in the model name silently selected zero reads — so the
    // assertion above counts the narrowed set and fails at zero. Shown here
    // on a name that really is absent.
    const src = readFileSync(join(SRC, "lib/flashcards/cache.ts"), "utf8");
    const body = symbolBody(src, "fetchFlashcardIndex");
    const models = readOffsets(body).map((r) => r.model);
    expect(models).toContain("audioAsset");
    expect(models).toContain("flashcardCard");
    expect(models.filter((m) => m === "typoAsset")).toEqual([]);
    // the content read really is still bare, which is the point
    expect(unguardedReads(body)).toEqual(["flashcardCard"]);
  });

  it("positive control: an unwrapped read is reported", () => {
    // Without this, every assertion above could be passing because the
    // scanner finds nothing rather than because every read is wrapped.
    const clean = symbolBody(readFileSync(join(SRC, "lib/glossary-audio.ts"), "utf8"), "attachGlossaryAudio");
    expect(unguardedReads(clean)).toEqual([]);

    const planted = clean + "\nasync function later() { const x = await db.story.findMany(); return x; }\n";
    expect(unguardedReads(planted)).toEqual(["story"]);
  });

  it("positive control: the scanner is not fooled by a brace inside a comment", () => {
    // A naive /try\s*\{[^}]*\}/ ends the block at the first "}" in a doc
    // comment and would call a genuinely wrapped read unguarded — the same
    // failure that hid 25 columns from ensure-schema-sync.ts.
    const tricky = `
      try {
        // shape: { id: string, rows: number[] }
        const rows = await db.glossaryTerm.findMany();
        return rows;
      } catch (error) {
        console.error("x", error);
      }
    `;
    expect(unguardedReads(tricky)).toEqual([]);
    // and the naive version really does disagree, so the control is not vacuous
    expect(/try\s*\{[^}]*await db\./.test(tricky)).toBe(false);
  });

  it("positive control: symbolBody reads the whole function, braces and all", () => {
    // If it stopped early, MUST_FAIL_LOUDLY would pass by seeing nothing.
    const body = symbolBody(readFileSync(join(SRC, "lib/word-games/data.ts"), "utf8"), "getAllPremiumOnlySequences");
    expect(body).toContain("premiumOnly: true");
    expect(body).toContain("return byPair;");
    expect(() => symbolBody("const x = 1;", "nope")).toThrow(/symbol not found/);
  });

  it("positive control: a read quoted in a comment is not counted", () => {
    // sitemap.ts's own header sentence contains "db.story.findMany()".
    // Before the comment stripper this file reported it as an unguarded
    // read, so the check was wrong in the direction that creates work.
    const quoted = `// so db.story.findMany() below hit a real prod deploy failure\nconst x = 1;`;
    expect(readOffsets(quoted)).toEqual([]);
    // and the same text OUTSIDE a comment is still found, so the stripper
    // has not simply blinded the scanner
    expect(readOffsets(`const x = db.story.findMany();`).map((r) => r.model)).toEqual(["story"]);
  });

  it("the indirect-read list still names real exports", () => {
    // A rename would otherwise empty this list silently and every
    // indirect read would go back to being invisible.
    for (const { name, definedIn } of DB_BACKED_HELPERS) {
      const src = readFileSync(join(SRC, definedIn), "utf8");
      expect(src, `${definedIn} no longer exports ${name}`).toMatch(
        new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${name}\\b`),
      );
      expect(readOffsets(src).length, `${definedIn}: ${name} no longer touches the database`).toBeGreaterThan(0);
    }
  });

  it("records why some reads deliberately stay unguarded", () => {
    expect(MUST_FAIL_LOUDLY.length).toBeGreaterThanOrEqual(5);
    for (const { why } of MUST_FAIL_LOUDLY) expect(why.length).toBeGreaterThan(60);
    for (const reason of Object.values(LEFT_ALONE_ON_PURPOSE)) expect(reason.length).toBeGreaterThan(60);
  });
});
