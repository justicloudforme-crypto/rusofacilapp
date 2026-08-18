import { describe, expect, it } from "vitest";
import { generateGroupInviteCode, isPlausibleGroupInviteCode } from "./groups";

describe("generateGroupInviteCode", () => {
  it("generates a 7-character code from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateGroupInviteCode();
      expect(code).toHaveLength(7);
      expect(isPlausibleGroupInviteCode(code)).toBe(true);
    }
  });
});

describe("isPlausibleGroupInviteCode", () => {
  it("accepts a well-formed code", () => {
    expect(isPlausibleGroupInviteCode("ABCDEFG")).toBe(true);
  });

  it("rejects the wrong length and garbage input", () => {
    expect(isPlausibleGroupInviteCode("ABC")).toBe(false);
    expect(isPlausibleGroupInviteCode("../join")).toBe(false);
    expect(isPlausibleGroupInviteCode("")).toBe(false);
  });
});
