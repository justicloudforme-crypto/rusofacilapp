import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

export function signUserId(userId: string): string {
  const signature = createHmac("sha256", getSecret()).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

export function verifySessionToken(token: string): string | null {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) return null;

  const userId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = createHmac("sha256", getSecret()).update(userId).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}
