import { describe, expect, it } from "vitest";
import { generateShortCode, isPlausibleShortCode } from "./short-code";

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

describe("isPlausibleShortCode", () => {
  it("accepts a code the generator produced", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode(CROCKFORD, 8);
      expect(isPlausibleShortCode(code, CROCKFORD, 8), code).toBe(true);
    }
  });

  it("rejects the wrong length and characters outside the alphabet", () => {
    expect(isPlausibleShortCode("ABCDEFG", CROCKFORD, 8)).toBe(false);
    expect(isPlausibleShortCode("ABCDEFGHI", CROCKFORD, 8)).toBe(false);
    expect(isPlausibleShortCode("", CROCKFORD, 8)).toBe(false);
    // 0, 1, I, L, O are deliberately absent from this alphabet (they read
    // ambiguously); a code containing one is not one we issued.
    expect(isPlausibleShortCode("ABCDEFG0", CROCKFORD, 8)).toBe(false);
    expect(isPlausibleShortCode("ABCDEFGl", CROCKFORD, 8)).toBe(false);
  });

  it("survives an alphabet containing regex metacharacters", () => {
    // This is the reason the regex went away on 30.08.2026. The old
    // implementation interpolated the alphabet into a character class, so
    // "A-F" became the RANGE A to F and silently accepted B, C, D, E — and
    // a trailing "]" or "\" would have thrown or mismatched instead.
    // Nothing in the app uses such an alphabet today; the point is that it
    // would have failed quietly if one ever did.
    const withDash = "A-F";
    expect(isPlausibleShortCode("A-F", withDash, 3)).toBe(true);
    expect(isPlausibleShortCode("ABC", withDash, 3)).toBe(false);
    expect(isPlausibleShortCode("BCD", withDash, 3)).toBe(false);

    const withClassChars = "^]\\.*+?";
    expect(isPlausibleShortCode("^]\\", withClassChars, 3)).toBe(true);
    expect(isPlausibleShortCode("abc", withClassChars, 3)).toBe(false);
    // A "." must not behave as "any character".
    expect(isPlausibleShortCode("xyz", ".", 3)).toBe(false);
    expect(isPlausibleShortCode("...", ".", 3)).toBe(true);
  });

  it("positive control: the old implementation really did get these wrong", () => {
    // Kept as a literal so the claim above is checked rather than asserted.
    const old = (value: string, alphabet: string, length: number) =>
      new RegExp(`^[${alphabet}]{${length}}$`).test(value);
    // A dash turns two neighbours into a range: "A-F" accepted B, C, D, E,
    // none of which the generator can ever emit.
    expect(old("BCD", "A-F", 3)).toBe(true);
    expect(isPlausibleShortCode("BCD", "A-F", 3)).toBe(false);
    // A closing bracket ends the class early — "[]]" is an empty class in
    // JavaScript, which matches nothing at all, so a valid code was
    // rejected.
    expect(old("]", "]", 1)).toBe(false);
    expect(isPlausibleShortCode("]", "]", 1)).toBe(true);
    // Not every metacharacter misbehaves inside a class — "." is a literal
    // there — which is exactly why this was easy to miss by reading.
    expect(old("xyz", ".", 3)).toBe(false);
  });

  it("measures length in the same units the generator writes", () => {
    // Both sides count UTF-16 code units: generateShortCode indexes the
    // alphabet with alphabet[i], so an alphabet outside the BMP would
    // already produce broken surrogate halves before this function ever
    // saw them. Documented rather than fixed — all three alphabets in the
    // app are alphanumeric, and pretending to support astral characters
    // here while the generator cannot would be the worse lie.
    const code = generateShortCode(CROCKFORD, 8);
    expect(code.length).toBe(8);
    expect(isPlausibleShortCode(code, CROCKFORD, 8)).toBe(true);
    // An astral alphabet is out of contract on both sides, consistently.
    expect(isPlausibleShortCode("🙂🙂", "🙂", 2)).toBe(false);
  });
});

describe("generateShortCode", () => {
  it("produces the requested length from the given alphabet only", () => {
    const code = generateShortCode(CROCKFORD, 12);
    expect(code.length).toBe(12);
    for (const char of code) expect(CROCKFORD).toContain(char);
  });

  it("does not return the same code twice in a row", () => {
    // A weak but real guard against someone replacing randInt with a
    // constant; 50 draws from 31^8 colliding would be extraordinary.
    const codes = new Set(Array.from({ length: 50 }, () => generateShortCode(CROCKFORD, 8)));
    expect(codes.size).toBe(50);
  });
});
