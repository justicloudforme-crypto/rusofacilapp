import { describe, expect, it } from "vitest";
import { generatePublicHandle, isPlausiblePublicHandle } from "./public-profile";

describe("generatePublicHandle", () => {
  it("generates an 8-character lowercase handle from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const handle = generatePublicHandle();
      expect(handle).toHaveLength(8);
      expect(isPlausiblePublicHandle(handle)).toBe(true);
    }
  });

  it("never includes visually ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const handle = generatePublicHandle();
      expect(handle).not.toMatch(/[01oil]/);
    }
  });
});

describe("isPlausiblePublicHandle", () => {
  it("accepts a well-formed handle", () => {
    expect(isPlausiblePublicHandle("abcdefgh")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isPlausiblePublicHandle("abc")).toBe(false);
    expect(isPlausiblePublicHandle("abcdefghi")).toBe(false);
  });

  it("rejects uppercase and ambiguous characters", () => {
    expect(isPlausiblePublicHandle("ABCDEFGH")).toBe(false);
    expect(isPlausiblePublicHandle("abcdefg0")).toBe(false);
  });

  it("rejects garbage input without throwing", () => {
    expect(isPlausiblePublicHandle("../admin")).toBe(false);
    expect(isPlausiblePublicHandle("")).toBe(false);
  });
});
