import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
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
