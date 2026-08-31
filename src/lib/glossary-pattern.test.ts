import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./regex";

/**
 * The glossary term list must always build a valid regular expression.
 *
 * Incident №1, 29.08.2026. GlossaryText.tsx auto-links grammar terms inside
 * lesson and story text by compiling ONE alternation over every glossary
 * term, with flags "giu". Three of the 119 live terms contain a hyphen, and
 * escapeRegExp emitted `\-`, which the `u` flag rejects as an invalid
 * escape. `new RegExp` therefore threw at construction, during render, in a
 * client component with no error boundary above it — so all 120 lessons
 * in both locales (240 URLs) showed nothing but "Something went wrong",
 * while every one still answered HTTP 200 with complete, correct HTML.
 *
 * regex.test.ts now covers escapeRegExp itself. This file covers the other
 * half: the terms are editorial content, added by hand and by seed script,
 * and one alternation means one bad row costs every page. A term with a
 * character nobody anticipated must fail here, in CI, and not in a
 * student's browser.
 *
 * Reads the seed file as text rather than importing it: prisma/ modules are
 * CLI scripts (see src/lib/entry-point.ts) and this needs the data, not the
 * script.
 */

const SEED = join(process.cwd(), "prisma", "seed-glossary.ts");

/** Every `term: "…"` literal in the seed file. */
function seedTerms(): string[] {
  const source = readFileSync(SEED, "utf8");
  const out: string[] = [];
  for (const match of source.matchAll(/^\s{4}term:\s*"((?:[^"\\]|\\.)*)"/gm)) {
    out.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  }
  return out;
}

/** Exactly what getMatcher() in GlossaryText.tsx builds. Kept in step with
 * it by the assertion below, which reads that file and checks the flags. */
function buildPattern(terms: string[], escape: (value: string) => string = escapeRegExp): RegExp {
  const alternatives = [...new Set(terms.map((t) => t.toLowerCase()))]
    .sort((a, b) => b.length - a.length)
    .map(escape);
  return new RegExp(`(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])`, "giu");
}

describe("glossary term pattern", () => {
  const terms = seedTerms();

  it("finds the terms at all", () => {
    // Without this an empty list would build a trivially valid pattern and
    // make every assertion below pass — PROGRESS.md 4.1.
    expect(terms.length).toBeGreaterThan(100);
    expect(terms).toContain("verbo reflexivo (con -ся)");
  });

  it("compiles as one alternation, with the flags the component uses", () => {
    expect(() => buildPattern(terms)).not.toThrow();
  });

  it("compiles term by term, so a failure names the offender", () => {
    const broken: string[] = [];
    for (const term of terms) {
      try {
        buildPattern([term]);
      } catch {
        broken.push(term);
      }
    }
    expect(broken).toEqual([]);
  });

  it("each term still matches its own text", () => {
    // A pattern that compiles but matches nothing would pass the two tests
    // above while silently switching auto-linking off.
    for (const term of terms) {
      const re = buildPattern([term]);
      expect(re.test(term), term).toBe(true);
    }
  });

  it("positive control: a term with a character that breaks the pattern is caught", () => {
    // Not hypothetical — the first is the real string that caused the
    // incident, run through the escaping that was in place at the time.
    const oldEscape = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    expect(() =>
      new RegExp(`(?<![\\p{L}])(${oldEscape("verbo reflexivo (con -ся)")})(?![\\p{L}])`, "giu")
    ).toThrow(SyntaxError);
    // And the scanner above would report an unescaped term today.
    expect(() =>
      new RegExp(`(?<![\\p{L}])(${["verbo (con"].join("|")})(?![\\p{L}])`, "giu")
    ).toThrow(SyntaxError);
  });

  it("the component still builds the pattern this test mirrors", () => {
    // This file duplicates getMatcher's construction. If that changes shape
    // — different flags, different boundary — this test would keep passing
    // while checking something the app no longer does.
    const component = readFileSync(
      join(process.cwd(), "src", "components", "glossary", "GlossaryText.tsx"),
      "utf8"
    );
    expect(component).toContain('"giu"');
    expect(component).toContain("(?<![\\\\p{L}])");
    expect(component).toContain("escapeRegExp");
    // …and a failure to compile must not be allowed to take the page down
    // a second time, whatever the cause.
    expect(component).toMatch(/try\s*\{[\s\S]*new RegExp[\s\S]*\}\s*catch/);
  });
});

/**
 * 31.08.2026. A production Sentry issue (JAVASCRIPT-NEXTJS-F, 20 events)
 * reported this pattern throwing again, and the term visible in the failing
 * pattern body was `конструкция «чем..., тем...»` — a comma, not a hyphen.
 * It turned out to be incident №1 itself: every event carries a release
 * (249b0265, 4c59b088) that predates the fix commit by hours, and the
 * message's head matches the pre-fix escaping character for character. The
 * comma is innocent, and no live term contains one.
 *
 * "Innocent today" is not a property worth relying on, though: the terms
 * are edited from the admin screen, and the reason to look at a comma at
 * all was that it plausibly could have been the next `-`. So both
 * characters are pinned here by name, and the check that runs against the
 * real database rather than the seed file is scripts/check-glossary-pattern.mjs.
 */
describe("a term with punctuation nobody planned for", () => {
  const PLANTED = [
    "конструкция «чем..., тем...»", // the comma from the 31.08 report
    "по-русски", // the hyphen from incident №1
    "modo «que»/«qué»", // a slash — illegal in a class under the v flag
    "sufijo -ся && -сь", // ASCII double punctuator
  ];

  it("compiles, alone and inside the full alternation", () => {
    for (const term of PLANTED) {
      expect(() => buildPattern([term]), term).not.toThrow();
      expect(buildPattern([term]).test(term.toLowerCase()), term).toBe(true);
    }
    expect(() => buildPattern([...seedTerms(), ...PLANTED])).not.toThrow();
  });

  it("positive control: the pre-fix escaping throws on the hyphen and passes the comma", () => {
    // This is the whole diagnosis in two assertions. The escaping that was
    // live on releases 249b0265/4c59b088 rejects the hyphen — that is the
    // reported crash — and accepts the comma, which is why the comma was
    // never the cause.
    const preFix = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    const withEscape = (term: string, escape: (v: string) => string) =>
      new RegExp(`(?<![\\p{L}])(${escape(term.toLowerCase())})(?![\\p{L}])`, "giu");
    expect(() => withEscape("по-русски", preFix)).toThrow(SyntaxError);
    expect(() => withEscape("конструкция «чем..., тем...»", preFix)).not.toThrow();
    // And the real alternation the report showed: the live term list under
    // the pre-fix escaping does not compile, under the current one it does.
    expect(() => buildPattern(seedTerms(), preFix)).toThrow(SyntaxError);
    expect(() => buildPattern(seedTerms())).not.toThrow();
  });
});
