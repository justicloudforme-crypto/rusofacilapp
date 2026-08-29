import { describe, expect, it } from "vitest";
import { levelSlugs } from "./courses";
import { isExamSlugFormat } from "./exams/slug";
import { escapeRegExp } from "./regex";

/**
 * The sweep of 31.08.2026: every place that builds a regular expression out
 * of runtime data, checked the same way isPlausibleShortCode was checked —
 * by running the pattern against input containing regex metacharacters and
 * seeing whether it lies.
 */

const METACHARACTERS = [".", "*", "+", "?", "^", "$", "{", "}", "(", ")", "|", "[", "]", "\\", "-"];

describe("escapeRegExp", () => {
  it("makes every metacharacter match itself and nothing else", () => {
    for (const char of METACHARACTERS) {
      const re = new RegExp(`^${escapeRegExp(char)}$`);
      expect(re.test(char), `${char} should match itself`).toBe(true);
      expect(re.test("x"), `${char} should not match x`).toBe(false);
    }
  });

  it("neutralises the patterns that would otherwise match too much", () => {
    expect(new RegExp(`^${escapeRegExp(".")}$`).test("a")).toBe(false);
    expect(new RegExp(`^${escapeRegExp("a.c")}$`).test("abc")).toBe(false);
    expect(new RegExp(`^${escapeRegExp("a.c")}$`).test("a.c")).toBe(true);
    expect(new RegExp(`^${escapeRegExp("a|b")}$`).test("a")).toBe(false);
    expect(new RegExp(`^${escapeRegExp("a|b")}$`).test("a|b")).toBe(true);
    expect(new RegExp(`^${escapeRegExp("(x)")}$`).test("x")).toBe(false);
  });

  it("escapes the dash, which only matters inside a character class", () => {
    // Outside a class "\-" is just "-", so escaping it costs nothing; inside
    // one it is the difference between three literals and a range. This is
    // the exact bug isPlausibleShortCode had.
    expect(escapeRegExp("A-F")).toBe("A\\-F");
    expect(new RegExp(`^[${escapeRegExp("A-F")}]$`).test("B")).toBe(false);
    expect(new RegExp(`^[${escapeRegExp("A-F")}]$`).test("-")).toBe(true);
  });

  it("positive control: without escaping these same cases go wrong", () => {
    // Runs the unescaped expression so the claims above are demonstrated
    // rather than asserted.
    expect(new RegExp("^.$").test("a")).toBe(true);
    expect(new RegExp("^a|b$").test("a")).toBe(true);
    expect(new RegExp("^[A-F]$").test("B")).toBe(true);
    // An unbalanced group or class does not mismatch, it throws — the one
    // loud failure mode in a family of silent ones.
    expect(() => new RegExp("^(a$")).toThrow();
    expect(() => new RegExp("^[a$")).toThrow();
    expect(new RegExp(`^${escapeRegExp("(a")}$`).test("(a")).toBe(true);
  });

  it("leaves ordinary text alone", () => {
    for (const value of ["comida", "кто-то что-то", "a1-exam-2", "señor"]) {
      // Escaped text still matches itself; that is the only contract.
      expect(new RegExp(`^${escapeRegExp(value)}$`).test(value), value).toBe(true);
    }
  });
});

describe("isExamSlugFormat", () => {
  it("accepts the real shape for every level and rejects the near misses", () => {
    for (const level of levelSlugs) {
      expect(isExamSlugFormat(level, `${level}-exam-1`)).toBe(true);
      expect(isExamSlugFormat(level, `${level}-exam-12`)).toBe(true);
      expect(isExamSlugFormat(level, `${level}-exam-0`)).toBe(false);
      expect(isExamSlugFormat(level, `${level}-exam-`)).toBe(false);
      expect(isExamSlugFormat(level, `${level}-exam-1x`)).toBe(false);
      expect(isExamSlugFormat(level, `x${level}-exam-1`)).toBe(false);
    }
  });

  it("does not let a metacharacter level match a slug it should not", () => {
    // Every caller validates the level with isLevelSlug() first and && short
    // -circuits, so this cannot happen today. It is asserted anyway because
    // that safety lives in the call sites, not in this function's signature.
    expect(isExamSlugFormat("a.", "ab-exam-1")).toBe(false);
    expect(isExamSlugFormat("a1|b2", "b2-exam-1")).toBe(false);
    expect(isExamSlugFormat("(a1)", "a1-exam-1")).toBe(false);
    expect(isExamSlugFormat("a.", "a.-exam-1")).toBe(true);
  });

  it("positive control: unescaped, those same levels DO match wrongly", () => {
    const unescaped = (level: string, slug: string) =>
      new RegExp(`^${level}-exam-[1-9][0-9]*$`).test(slug);
    expect(unescaped("a.", "ab-exam-1")).toBe(true);
    expect(unescaped("a1|b2", "b2-exam-1")).toBe(true);
    // And a level that is not a valid pattern throws instead of returning.
    expect(() => unescaped("a[", "a[-exam-1")).toThrow();
    expect(isExamSlugFormat("a[", "a[-exam-1")).toBe(true);
  });
});
