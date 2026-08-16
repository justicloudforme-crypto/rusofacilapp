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

  it("round-trips a user id and session version through sign/verify", () => {
    const token = signUserId("user-123", 0);
    expect(verifySessionToken(token)).toEqual({ userId: "user-123", sessionVersion: 0 });
  });

  it("round-trips a non-zero session version", () => {
    const token = signUserId("user-123", 4);
    expect(verifySessionToken(token)).toEqual({ userId: "user-123", sessionVersion: 4 });
  });

  it("rejects a token with a tampered user id", () => {
    const token = signUserId("user-123", 0);
    const signature = token.slice(token.lastIndexOf("."));
    const tampered = `user-456.0${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token with a tampered session version", () => {
    const token = signUserId("user-123", 0);
    const signature = token.slice(token.lastIndexOf("."));
    const tampered = `user-123.99${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token with a tampered signature", () => {
    const token = signUserId("user-123", 0);
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signUserId("user-123", 0);
    process.env.SESSION_SECRET = "a-completely-different-secret";
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rejects a malformed token with no separator", () => {
    expect(verifySessionToken("not-a-valid-token")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(verifySessionToken("")).toBeNull();
  });

  it("rejects a token whose version segment isn't a valid integer", () => {
    const token = signUserId("user-123", 0);
    const signature = token.slice(token.lastIndexOf("."));
    const tampered = `user-123.not-a-number${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it("allows a user id that itself contains dots, using the last separators", () => {
    const token = signUserId("user.with.dots", 2);
    expect(verifySessionToken(token)).toEqual({ userId: "user.with.dots", sessionVersion: 2 });
  });

  it("throws if SESSION_SECRET is not set", () => {
    delete process.env.SESSION_SECRET;
    expect(() => signUserId("user-123", 0)).toThrow("SESSION_SECRET");
  });
});
