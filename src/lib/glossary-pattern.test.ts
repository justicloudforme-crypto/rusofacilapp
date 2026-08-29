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
 * client component with no error boundary above it — so all 240 lesson
 * pages in both locales showed nothing but "Something went wrong", while
 * every one of them still answered HTTP 200 with complete, correct HTML.
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
function buildPattern(terms: string[]): RegExp {
  const alternatives = [...new Set(terms.map((t) => t.toLowerCase()))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
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
