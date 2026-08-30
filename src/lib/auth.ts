import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, shouldUseSecureSessionCookie, signUserId, verifySessionToken } from "./session-token";

/**
 * Real email+password authentication (see /api/auth/login and
 * /api/auth/register, password hashing in src/lib/password.ts). The session
 * cookie is HMAC-signed so it can't be forged (src/lib/session-token.ts) and
 * carries the `sessionVersion` it was issued with — bumping a user's
 * sessionVersion (change-password, reset-password, "sign out other
 * devices") invalidates every token signed with an older version, with no
 * server-side session table to store or clean up.
 * Accounts created before this existed have `passwordHash: null` — signing
 * up again with that same email "claims" the account and sets its first
 * password, rather than being locked out (see /api/auth/register).
 */
export async function createSession(userId: string, sessionVersion: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signUserId(userId, sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    // True on every real deployment. See shouldUseSecureSessionCookie for
    // the single exception (the e2e server) and why it exists.
    secure: shouldUseSecureSessionCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const parsed = verifySessionToken(token);
  if (!parsed) return null;

  const user = await db.user.findUnique({ where: { id: parsed.userId } });
  // A version mismatch means this token was issued before the user's most
  // recent password change / "sign out other devices" — treat it exactly
  // like no session at all, rather than a distinct error, since from the
  // caller's perspective it is one.
  if (!user || user.sessionVersion !== parsed.sessionVersion) return null;

  return user;
}
