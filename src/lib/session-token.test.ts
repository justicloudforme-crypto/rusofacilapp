import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signUserId, verifySessionToken } from "./session-token";

describe("session-token", () => {
  const originalSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-for-unit-tests";
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalSecret;
  });

  it("round-trips a user id through sign/verify", () => {
    const token = signUserId("user-123");
    expect(verifySessionToken(token)).toBe("user-123");
  });

  it("rejects a token with a tampered user id", () => {
    const token = signUserId("user-123");
    const [, signature] = token.split(".");
    const tampered = `user-456.${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token with a tampered signature", () => {
    const token = signUserId("user-123");
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signUserId("user-123");
    process.env.SESSION_SECRET = "a-completely-different-secret";
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects a malformed token with no separator", () => {
    expect(verifySessionToken("not-a-valid-token")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(verifySessionToken("")).toBeNull();
  });

  it("allows a user id that itself contains dots, using the last separator", () => {
    const token = signUserId("user.with.dots");
    expect(verifySessionToken(token)).toBe("user.with.dots");
  });

  it("throws if SESSION_SECRET is not set", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signUserId("user-123")).toThrow("SESSION_SECRET");
  });
});
