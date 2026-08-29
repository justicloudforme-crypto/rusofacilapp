import { describe, expect, it } from "vitest";
import {
  isDisallowed,
  isDisallowedIgnoringAllow,
  matchesRobotsPattern,
  decidingRule,
  parseRobotsTxt,
} from "./robots-matcher";

/**
 * The matcher used to live inside crawlable-surface.test.ts, where nothing
 * else could import it, so audit scripts kept rewriting it from the prose
 * in PROGRESS.md — and one rewrite dropped Allow precedence and reported
 * 160 pages that robots.txt opens on purpose as blocked. The number was
 * simply smaller; nothing looked broken.
 *
 * Controls here are built from DISPUTED cases (PROGRESS.md 4.5): paths
 * where Allow and Disallow actually collide. A control made of convenient
 * cases passes on the broken version too, which is how that defect
 * survived a passing 11-path check.
 */

/** The real shape of this project's robots.txt: one broad Disallow over
 * every word-game URL, re-opened rung by rung for the 80 free ones. */
const DISALLOWS = ["/admin", "/*/admin", "/api/", "/word-games/", "/*/word-games/", "/*/courses/*/exam/"];
const FREE_RUNGS = ["WORD_SEARCH", "CROSSWORD"].flatMap((type) =>
  ["A1", "A2", "B1", "B2"].flatMap((level) =>
    Array.from({ length: 10 }, (_, i) => `/*/word-games/${type}/${level}/${i + 1}$`),
  ),
);
const ALLOWS = ["/", ...FREE_RUNGS];

describe("robots.txt Allow beats Disallow by pattern length", () => {
  it("opens every free rung and keeps every paid one closed", () => {
    const free: string[] = [];
    const paid: string[] = [];
    for (const lang of ["es", "ru"]) {
      for (const type of ["WORD_SEARCH", "CROSSWORD"]) {
        for (const level of ["A1", "A2", "B1", "B2"]) {
          for (let n = 1; n <= 12; n++) {
            const path = `/${lang}/word-games/${type}/${level}/${n}`;
            (n <= 10 ? free : paid).push(path);
          }
        }
      }
    }
    expect(free).toHaveLength(160);
    expect(free.filter((p) => !isDisallowed(p, DISALLOWS, ALLOWS))).toHaveLength(160);
    expect(paid.filter((p) => isDisallowed(p, DISALLOWS, ALLOWS))).toHaveLength(paid.length);
  });

  it("positive control: the Disallow-only matcher gets all 160 wrong", () => {
    // The difference has to be demonstrated on real input, not asserted.
    // If these two ever agreed, this whole file would be describing a
    // distinction that does not exist.
    const free = ["es", "ru"].flatMap((lang) =>
      ["WORD_SEARCH", "CROSSWORD"].flatMap((type) =>
        ["A1", "A2", "B1", "B2"].flatMap((level) =>
          Array.from({ length: 10 }, (_, i) => `/${lang}/word-games/${type}/${level}/${i + 1}`),
        ),
      ),
    );
    const wronglyBlocked = free.filter((p) => isDisallowedIgnoringAllow(p, DISALLOWS));
    expect(wronglyBlocked).toHaveLength(160);
    expect(free.filter((p) => isDisallowed(p, DISALLOWS, ALLOWS))).toHaveLength(0);
  });

  it("`Allow: /` is length 1 and overrides nothing", () => {
    // The single most tempting wrong reading of the rule.
    expect(isDisallowed("/es/admin/users", ["/*/admin"], ["/"])).toBe(true);
    expect(decidingRule("/es/admin/users", [
      { pattern: "/*/admin", allow: false },
      { pattern: "/", allow: true },
    ])?.pattern).toBe("/*/admin");
  });

  it("Allow wins an exact tie, and only an exact tie", () => {
    expect(isDisallowed("/groups", ["/groups"], ["/groups"])).toBe(false);
    // one character longer on the Disallow side and it wins again
    expect(isDisallowed("/groups/x", ["/groups/x"], ["/groups"])).toBe(true);
  });

  it("treats a wildcard as ordinary characters when measuring length", () => {
    // Google's rule: the pattern's own length decides, not the length of
    // what it expands to. `/*/word-games/` (14) loses to a 30-character
    // Allow even though the wildcard could match far more text.
    const allow = "/*/word-games/WORD_SEARCH/A1/1$";
    expect(allow.length).toBeGreaterThan("/*/word-games/".length);
    expect(isDisallowed("/es/word-games/WORD_SEARCH/A1/1", ["/*/word-games/"], [allow])).toBe(false);
  });

  it("anchors on a trailing $ and matches as a prefix otherwise", () => {
    expect(matchesRobotsPattern("/es/word-games/WORD_SEARCH/A1/1", "/*/word-games/WORD_SEARCH/A1/1$")).toBe(true);
    // the anchor is what stops rung 1 from opening rung 10
    expect(matchesRobotsPattern("/es/word-games/WORD_SEARCH/A1/10", "/*/word-games/WORD_SEARCH/A1/1$")).toBe(false);
    // and without the anchor it would
    expect(matchesRobotsPattern("/es/word-games/WORD_SEARCH/A1/10", "/*/word-games/WORD_SEARCH/A1/1")).toBe(true);
  });

  it("escapes pattern text instead of letting it act as a regex", () => {
    // A pattern is data — it comes out of a served robots.txt (rule 4.4).
    expect(matchesRobotsPattern("/a+b", "/a+b")).toBe(true);
    expect(matchesRobotsPattern("/aaab", "/a+b")).toBe(false);
    expect(matchesRobotsPattern("/a.b", "/a.b")).toBe(true);
    expect(matchesRobotsPattern("/axb", "/a.b")).toBe(false);
  });

  it("reads a served robots.txt case-insensitively", () => {
    const rules = parseRobotsTxt(["User-Agent: *", "allow: /x", "DISALLOW: /x/y", "", "# comment"].join("\n"));
    expect(rules).toEqual([
      { pattern: "/x", allow: true },
      { pattern: "/x/y", allow: false },
    ]);
    expect(isDisallowed("/x/y/z", ["/x/y"], ["/x"])).toBe(true);
  });

  it("an empty Disallow value means nothing is blocked", () => {
    // `Disallow:` with no path is the standard way to say "allow all"; a
    // matcher that treats "" as a prefix would block the entire site.
    expect(isDisallowed("/anything", [""], [])).toBe(false);
    expect(isDisallowedIgnoringAllow("/anything", [""])).toBe(false);
  });
});
