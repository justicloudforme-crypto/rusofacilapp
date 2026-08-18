import { describe, expect, it } from "vitest";
import { generateReferralCode, isPlausibleReferralCode } from "./referral";

describe("generateReferralCode", () => {
  it("generates a 7-character code from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(7);
      expect(isPlausibleReferralCode(code)).toBe(true);
    }
  });

  it("never includes visually ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
});

describe("isPlausibleReferralCode", () => {
  it("accepts a well-formed code", () => {
    expect(isPlausibleReferralCode("ABCDEFG")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isPlausibleReferralCode("ABC")).toBe(false);
    expect(isPlausibleReferralCode("ABCDEFGH")).toBe(false);
  });

  it("rejects lowercase and ambiguous characters", () => {
    expect(isPlausibleReferralCode("abcdefg")).toBe(false);
    expect(isPlausibleReferralCode("ABCDEF0")).toBe(false);
    expect(isPlausibleReferralCode("ABCDEFI")).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(isPlausibleReferralCode("<script>")).toBe(false);
    expect(isPlausibleReferralCode("")).toBe(false);
  });
});
