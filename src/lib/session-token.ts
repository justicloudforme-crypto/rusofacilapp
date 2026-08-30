import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Whether the session cookie is issued with the `Secure` attribute.
 *
 * Exactly one environment answers "no": the server playwright.config.ts
 * spawns for an e2e run. That server is `next start` (so NODE_ENV is
 * "production" no matter how the build was made) on plain-HTTP localhost,
 * and WebKit drops a Secure cookie there — silently, which used to leave
 * the WebKit projects running their whole suite logged out while still
 * reporting green wherever a page had a free-tier fallback. E2E_TEST_SEED
 * is the same gate that arms /api/test/grant-subscription and is never set
 * on a deployment.
 *
 * A pure function rather than an inline expression so it can be asserted
 * on directly — see session-token.test.ts. The one thing that must never
 * regress is the production case.
 *
 * Two conditions have to agree before Secure comes off, not one. Relying on
 * E2E_TEST_SEED alone put a live deployment one stray environment variable
 * away from issuing session cookies over plain HTTP: nothing about that
 * name says "never set this in production", and nothing would have
 * complained if somebody had. `VERCEL` is set to "1" by the platform in
 * every Vercel runtime and cannot be true on the localhost server
 * playwright.config.ts spawns, so requiring its absence makes the exception
 * unreachable on a deployment by construction rather than by convention.
 * Verified read-only against production on 30.08.2026 as well: POST
 * /api/test/grant-subscription answers 404 there, which is that route's
 * first check on the same E2E_TEST_SEED — so the flag is unset in the live
 * environment too (PROGRESS.md 7.56).
 */
export function shouldUseSecureSessionCookie(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  const isE2EServer = env.E2E_TEST_SEED === "1" && !env.VERCEL;
  return !isE2EServer;
}

export interface SessionTokenPayload {
  userId: string;
  sessionVersion: number;
}

export function signUserId(userId: string, sessionVersion: number): string {
  const payload = `${userId}.${sessionVersion}`;
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  // Signature is always the last segment; the version is the last segment
  // of what remains — this order still lets userId itself contain dots
  // (cuids never do, but nothing here should assume that).
  const signatureSeparator = token.lastIndexOf(".");
  if (signatureSeparator === -1) return null;

  const payload = token.slice(0, signatureSeparator);
  const signature = token.slice(signatureSeparator + 1);

  const versionSeparator = payload.lastIndexOf(".");
  if (versionSeparator === -1) return null;

  const userId = payload.slice(0, versionSeparator);
  const sessionVersion = Number(payload.slice(versionSeparator + 1));
  if (!userId || !Number.isInteger(sessionVersion) || sessionVersion < 0) return null;

  const expected = createHmac("sha256", getSecret()).update(payload).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return { userId, sessionVersion };
}
