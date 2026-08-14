import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { SESSION_COOKIE, signUserId, verifySessionToken } from "./session-token";

/**
 * Demo/mock authentication: no password check, just an email-based
 * find-or-create flow (see /api/auth/login). The session cookie is
 * HMAC-signed so it can't be forged, but this is not a production-grade
 * auth system — it's a stand-in so subscription/access-control logic has
 * a real user to check against.
 */
export async function createSession(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signUserId(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}
