import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./regex";

/**
 * Content from the database must not be able to kill a render by being
 * malformed.
 *
 * The class, from incident №1: `escapeRegExp` emitted `\-`, which is an
 * invalid escape under the `u` flag, so `new RegExp` threw at construction.
 * It sat in the repository from the first commit and only became fatal on
 * 19.08.2026, when a glossary term containing a hyphen reached the
 * production database. Nothing about the code changed; a row did.
 *
 * The sweep of 29.08.2026 looked for every other place where a value from
 * the database or from a user reaches something that can throw — a regular
 * expression, a parser — with a render downstream of it. Findings and the
 * decision for each are in PROGRESS.md 7.40. Two rules came out of it, and
 * this file holds them:
 *
 *   1. Every runtime RegExp built from data escapes that data, and any
 *      construction under the `u` flag is wrapped or provably safe.
 *   2. Every JSON.parse of a database column is wrapped, and the wrapper
 *      decides deliberately between degrading and failing.
 */

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Prisma's generated client parses its own embedded schema; it is not
      // ours to guard and it never sees a database row.
      if (entry === "generated") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const FILES = sourceFiles(SRC);

/** Comments blanked, offsets kept — several of these files quote patterns
 * and parser calls in prose. */
function withoutComments(source: string): string {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      // The `[^:]` is not decoration. Without it the `//` in
      // "https://api.openai.com/v1/audio/speech" starts a line comment and
      // blanks the rest of the line — which is exactly how the first draft
      // of this scanner passed with a planted TTS call sitting in src/.
      // Caught by the positive control, which is the only reason it is not
      // still passing.
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, before: string) => before + " ".repeat(m.length - before.length))
  );
}

describe("data that reaches a regular expression", () => {
  it("finds the call sites at all", () => {
    // Without this, an empty scan makes every assertion below vacuous.
    const withRegExp = FILES.filter((f) => /new RegExp\(/.test(withoutComments(readFileSync(f, "utf8"))));
    expect(withRegExp.length).toBeGreaterThan(4);
  });

  it("every runtime RegExp built from an interpolated value escapes it", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/new RegExp\(\s*`([^`]*)`/g)) {
        const template = match[1];
        // Only templates that interpolate something are interesting; a
        // literal pattern is the author's own text.
        for (const interpolation of template.matchAll(/\$\{([^}]*)\}/g)) {
          const expr = interpolation[1];
          const escaped = /escapeRegExp|alternatives|\.map\(escapeRegExp\)/.test(expr);
          if (!escaped) offenders.push(`${relative(SRC, file)}: \${${expr.trim().slice(0, 50)}}`);
        }
      }
    }
    // `alternatives` in GlossaryText is a list already mapped through
    // escapeRegExp; `body` in story-insights is hand-written pattern source,
    // asserted separately below.
    expect(offenders.filter((o) => !o.includes("${body}"))).toEqual([]);
  });

  it("story-insights' patterns really are hand-written, not data", () => {
    // Its ru() helper takes regex SOURCE on purpose, so escaping would break
    // it. That is only safe while its inputs are literals in the file.
    const source = readFileSync(join(SRC, "lib", "story-insights.ts"), "utf8");
    // Every pattern comes from one const array of string literals…
    expect(source).toMatch(/const FEATURE_PATTERNS: \{ slug: string; pattern: string \}\[\] = \[/);
    // …and ru() is called with nothing but a member of it.
    const calls = [...withoutComments(source).matchAll(/\bru\(([^)]*)\)/g)].map((m) => m[1].trim());
    expect(calls.filter((c) => c !== "pattern" && c !== "body: string")).toEqual([]);
  });

  it("escapeRegExp output is safe under the u flag, in and out of a class", () => {
    // The incident in one assertion. Includes the three live glossary terms
    // and a user search query, which is the second place this reached
    // (src/app/api/flashcards/route.ts builds `\b${escapeRegExp(needle)}`
    // with the u flag from the visitor's own search text).
    const inputs = [
      "oración indefinido-personal",
      "verbo reflexivo (con -ся)",
      "«-то» frente a «-нибудь»",
      "кто-то",
      "-ся",
      "a-b]c\\d",
    ];
    for (const value of inputs) {
      expect(() => new RegExp(`\\b${escapeRegExp(value)}`, "u"), value).not.toThrow();
      expect(() => new RegExp(`[${escapeRegExp(value)}]`, "u"), value).not.toThrow();
      expect(new RegExp(`^${escapeRegExp(value)}$`, "u").test(value), value).toBe(true);
    }
  });

  it("positive control: the escaping this replaced throws on those same inputs", () => {
    const old = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    expect(() => new RegExp(`\\b${old("кто-то")}`, "u")).toThrow(SyntaxError);
    expect(() => new RegExp(`\\b${old("verbo reflexivo (con -ся)")}`, "u")).toThrow(SyntaxError);
    // …and passes without u, which is exactly why it survived so long.
    expect(() => new RegExp(`\\b${old("кто-то")}`)).not.toThrow();
  });

  it("positive control: the scanner reports an unescaped interpolation", () => {
    const planted = 'const re = new RegExp(`^${userInput}$`, "u");';
    const found: string[] = [];
    for (const match of planted.matchAll(/new RegExp\(\s*`([^`]*)`/g)) {
      for (const interpolation of match[1].matchAll(/\$\{([^}]*)\}/g)) {
        if (!/escapeRegExp/.test(interpolation[1])) found.push(interpolation[1]);
      }
    }
    expect(found).toEqual(["userInput"]);
  });
});

/**
 * Every JSON.parse of a database column, with the decision made for each.
 * Listed by hand rather than scanned, because the interesting part is not
 * "is it wrapped" but "what should happen when it fails", and that is a
 * judgement no regex can make. The test's job is to notice when one of
 * these loses its guard.
 */
const DB_JSON_PARSERS: Array<{ file: string; guard: RegExp; why: string }> = [
  {
    file: "app/[lang]/stories/[id]/page.tsx",
    guard: /function parseSentenceOffsets[\s\S]*?catch/,
    why: "offsets drive audio highlighting; the story must survive without them",
  },
  {
    file: "lib/word-games/data.ts",
    guard: /try \{[\s\S]*?JSON\.parse\(row\.gridData\)[\s\S]*?catch/,
    why: "a puzzle without its grid is not a puzzle — degrade to null, which callers render as 404",
  },
  {
    file: "lib/media/data.ts",
    guard: /function parseSubtitles[\s\S]*?catch/,
    why: "subtitles are an enhancement; fall back to the static baseline",
  },
  {
    file: "lib/progress.ts",
    guard: /catch \{\s*mistakes = \[\];/,
    why: "already guarded before this sweep — mistakes/answers fall back to empty",
  },
];

describe("data that reaches a parser", () => {
  it("every listed database JSON.parse is guarded", () => {
    for (const { file, guard, why } of DB_JSON_PARSERS) {
      const source = readFileSync(join(SRC, file), "utf8");
      expect(guard.test(source), `${file} lost its guard (${why})`).toBe(true);
    }
  });

  it("positive control: the guard patterns do not match unguarded code", () => {
    // Otherwise the assertion above would pass on any file at all.
    const unguarded = "const offsets = JSON.parse(story.sentenceOffsetsJson) as number[];";
    for (const { guard } of DB_JSON_PARSERS) {
      expect(guard.test(unguarded)).toBe(false);
    }
  });

  it("no NEW unguarded JSON.parse of a row column appears", () => {
    // Narrow on purpose: `JSON.parse(row.x)` / `JSON.parse(something.fooJson)`
    // is the shape that reads a database column. A wider scan would drown in
    // legitimate parses of fetch responses and config files.
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(/JSON\.parse\((row|override|story|custom\w*|existing)\.\w+\)/g)) {
        const before = source.slice(Math.max(0, match.index - 400), match.index);
        if (!/\btry\s*\{/.test(before)) offenders.push(`${relative(SRC, file)}: ${match[0]}`);
      }
    }
    // Admin-only editors are allowed to fail loudly: they are used by one
    // person who can fix the row, and a silent fallback there would hide a
    // broken save instead of reporting it.
    expect(offenders.filter((o) => !o.includes("admin"))).toEqual([]);
  });
});
