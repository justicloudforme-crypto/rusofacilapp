import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldUseSecureSessionCookie, signUserId, verifySessionToken } from "./session-token";

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

describe("shouldUseSecureSessionCookie", () => {
  // The only case that actually protects anyone. Everything below it is
  // there so that a future edit which "simplifies" the rule has to notice
  // it broke this one.
  it("is true on a real production deployment", () => {
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "production" })).toBe(true);
  });

  it("is false only for the e2e server, which is production-mode over plain-HTTP localhost", () => {
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "production", E2E_TEST_SEED: "1" })).toBe(false);
  });

  // Positive control for the exception itself: the gate is the exact string
  // "1", the same comparison /api/test/grant-subscription makes. A truthy-ish
  // value must NOT open it, or an unrelated "E2E_TEST_SEED=true" somewhere
  // would drop Secure on a live deployment without anyone noticing.
  it("does not accept a merely truthy E2E_TEST_SEED", () => {
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "production", E2E_TEST_SEED: "true" })).toBe(true);
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "production", E2E_TEST_SEED: "0" })).toBe(true);
  });

  it("is false in development, where there is no HTTPS to be secure over", () => {
    expect(shouldUseSecureSessionCookie({ NODE_ENV: "development" })).toBe(false);
  });
});
