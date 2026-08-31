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
    // Inside a class the dash is the difference between three literals and
    // a range. This is the exact bug isPlausibleShortCode had.
    expect(new RegExp(`^[${escapeRegExp("A-F")}]$`).test("B")).toBe(false);
    expect(new RegExp(`^[${escapeRegExp("A-F")}]$`).test("-")).toBe(true);
  });

  it("escapes the dash as \\x2d, because \\- is illegal under the u flag", () => {
    // Incident №1, 29.08.2026. This function used to emit "A\\-F". Without
    // `u` that is accepted and harmless, which is why it stood from the
    // initial commit — every test here used the default flags. With `u` a
    // backslash may only precede a character the spec lists, `-` is not one
    // of them outside a class, and `new RegExp` throws at CONSTRUCTION.
    // GlossaryText builds one alternation over all 119 glossary terms with
    // flags "giu"; three of them contain a hyphen, so all 120 lessons in
    // both locales — 240 URLs — rendered "Something went wrong" while still
    // answering HTTP 200 with complete HTML.
    expect(escapeRegExp("A-F")).toBe("A\\x2dF");
    expect(escapeRegExp("A-F")).not.toContain("\\-");
  });

  it("every metacharacter survives the u flag, in and out of a class", () => {
    // The dimension the original sweep missed. `u` is not exotic here: it is
    // required by \p{L}, which every Unicode-aware pattern in this app uses
    // because \b and \w are ASCII-only and never fire between Cyrillic
    // letters. So `u` is the normal case, not the edge case.
    for (const char of METACHARACTERS) {
      expect(() => new RegExp(`^${escapeRegExp(char)}$`, "u"), `${char} outside a class`).not.toThrow();
      expect(new RegExp(`^${escapeRegExp(char)}$`, "u").test(char), `${char} matches itself`).toBe(true);
      expect(new RegExp(`^${escapeRegExp(char)}$`, "u").test("x"), `${char} matches only itself`).toBe(false);
    }
    // Inside a class, `]`, `\` and `^` are the ones that can break the class
    // itself rather than the escape.
    for (const char of METACHARACTERS) {
      expect(() => new RegExp(`^[${escapeRegExp(char)}]$`, "u"), `${char} inside a class`).not.toThrow();
    }
  });

  it("the real production strings that broke build a valid pattern", () => {
    // The three live glossary terms, verbatim, and the shape GlossaryText
    // actually builds — an alternation with the flags it actually uses.
    const terms = ["oración indefinido-personal", "verbo reflexivo (con -ся)", "«-то» frente a «-нибудь»"];
    for (const term of terms) {
      expect(() => new RegExp(`(?<![\\p{L}])(${escapeRegExp(term)})(?![\\p{L}])`, "giu"), term).not.toThrow();
      expect(new RegExp(`(?<![\\p{L}])(${escapeRegExp(term)})(?![\\p{L}])`, "giu").test(term), term).toBe(true);
    }
    const alternation = terms.map(escapeRegExp).join("|");
    expect(() => new RegExp(`(?<![\\p{L}])(${alternation})(?![\\p{L}])`, "giu")).not.toThrow();
  });

  it("positive control: the old implementation throws on those same strings", () => {
    // Demonstrated, not asserted — otherwise the four tests above would
    // still pass if escapeRegExp stopped escaping the dash at all, which
    // would reintroduce the character-class range bug instead.
    const oldEscapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    expect(() => new RegExp(`(${oldEscapeRegExp("oración indefinido-personal")})`, "giu")).toThrow(SyntaxError);
    expect(() => new RegExp(`(${oldEscapeRegExp("«-то» frente a «-нибудь»")})`, "giu")).toThrow(SyntaxError);
    // …and passes without `u`, which is precisely how it went unnoticed.
    expect(() => new RegExp(`(${oldEscapeRegExp("oración indefinido-personal")})`, "gi")).not.toThrow();
    // The current implementation still blocks the range it was written for.
    expect(new RegExp(`^[${escapeRegExp("A-F")}]$`, "u").test("B")).toBe(false);
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

/**
 * The whitelist rewrite of 31.08.2026 (round three of the same defect).
 *
 * Rounds one and two both patched a single character of a blacklist:
 * `-` was added to it, then `-` was moved to `\x2d`. Both patches were
 * right about the character in front of them and wrong about the method,
 * and the second one was still wrong when this suite was written — under
 * the `v` flag it leaves `/` and every ASCII double punctuator illegal
 * inside a character class. These tests check the METHOD: they enumerate
 * characters instead of naming them, so the next character nobody thought
 * of is covered before it reaches the database.
 */
describe("escapeRegExp is safe by construction, not by enumeration", () => {
  /** Every code point below the astral planes, plus a sample above them.
   * Dense where content actually lives (ASCII, Latin-1, Cyrillic, general
   * punctuation), sampled above that — a full sweep of 0x10FFFF takes
   * ~90s and buys nothing this does not already say. */
  function codePoints(): number[] {
    const out: number[] = [];
    for (let cp = 0; cp <= 0x30ff; cp++) out.push(cp);
    for (let cp = 0x3100; cp < 0x10000; cp += 7) out.push(cp);
    for (let cp = 0x10000; cp <= 0x10ffff; cp += 997) out.push(cp);
    return out;
  }

  it("every code point survives every flag set, in and out of a class", () => {
    const broken: string[] = [];
    for (const cp of codePoints()) {
      const char = String.fromCodePoint(cp);
      const escaped = escapeRegExp(char);
      const attempts: Array<[string, string, string]> = [
        ["u", `^${escaped}$`, "u"],
        ["u in class", `[${escaped}]`, "u"],
        ["v", `^${escaped}$`, "v"],
        ["v in class", `[${escaped}]`, "v"],
        ["no flags", `^${escaped}$`, ""],
        ["no flags in class", `[${escaped}]`, ""],
      ];
      for (const [label, source, flags] of attempts) {
        try {
          new RegExp(source, flags);
        } catch {
          broken.push(`U+${cp.toString(16)} (${label})`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("every code point still matches itself and nothing else", () => {
    // A pattern that compiles but no longer matches is the silent half of
    // this failure family — the glossary would just stop highlighting.
    const wrong: string[] = [];
    for (const cp of codePoints()) {
      const char = String.fromCodePoint(cp);
      const re = new RegExp(`^${escapeRegExp(char)}$`, "u");
      if (!re.test(char)) wrong.push(`U+${cp.toString(16)} does not match itself`);
      if (char !== "x" && re.test("x")) wrong.push(`U+${cp.toString(16)} also matches x`);
    }
    expect(wrong).toEqual([]);
  });

  it("positive control: the escaping this replaced fails that same sweep", () => {
    // Round two's implementation, verbatim. It passes under `u` — that is
    // why it shipped — and fails under `v`, which is the dimension the
    // sweep adds. Without this the test above would pass on the old code
    // and prove nothing.
    const roundTwo = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/-/g, "\\x2d");
    expect(() => new RegExp(`[${roundTwo("/")}]`, "v")).toThrow(SyntaxError);
    expect(() => new RegExp(`[${roundTwo(",,")}]`, "v")).toThrow(SyntaxError);
    // `&&` under `v` is worse than a throw: it is the set-intersection
    // operator, so the class compiles and quietly matches nothing.
    expect(new RegExp(`^[${roundTwo("a&&b")}]$`, "v").test("a")).toBe(false);
    expect(new RegExp(`^[${escapeRegExp("a&&b")}]$`, "v").test("a")).toBe(true);
    // …and round one's, which is the incident itself.
    const roundOne = (v: string) => v.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
    expect(() => new RegExp(`^${roundOne("кто-то")}$`, "u")).toThrow(SyntaxError);
    // Both of them are accepted by the current implementation.
    expect(() => new RegExp(`[${escapeRegExp("/")}]`, "v")).not.toThrow();
    expect(() => new RegExp(`^${escapeRegExp("кто-то")}$`, "u")).not.toThrow();
  });

  it("positive control: a comma and a hyphen in a term are ordinary, not fatal", () => {
    // The two characters named in the report of 31.08.2026. Both are
    // escaped now (`,` → \x2c, `-` → \x2d), and a term carrying either one
    // compiles and matches. Asserted with the exact strings so that a
    // future narrowing of the escape set fails here rather than in a
    // student's browser.
    for (const term of ["конструкция «чем..., тем...»", "«-то» frente a «-нибудь»"]) {
      const pattern = `(?<![\\p{L}])(${escapeRegExp(term.toLowerCase())})(?![\\p{L}])`;
      expect(() => new RegExp(pattern, "giu"), term).not.toThrow();
      expect(new RegExp(pattern, "giu").test(term.toLowerCase()), term).toBe(true);
    }
    expect(escapeRegExp(",")).toBe("\\x2c");
    expect(escapeRegExp("-")).toBe("\\x2d");
  });
});
