import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";

/** What an unsigned-in visitor's recordings are filed under. Lesson 1 of
 * every level is free and has the practice block, so this is a real case,
 * not a placeholder. */
export const ANONYMOUS_OWNER_SCOPE = "anon";

/**
 * The value a browser files its local practice recordings under
 * (src/lib/voice-recordings-store.ts). Two properties matter and nothing
 * else does:
 *
 *   - **stable for one account**, so a recording is still there tomorrow.
 *     It hashes the user id only, never the session version, so changing
 *     a password or signing out other devices does not orphan a student's
 *     recordings;
 *   - **not the user id**, because this string is rendered into the HTML
 *     of a page Googlebot also crawls. A salted SHA-256 prefix identifies
 *     the browser's own storage bucket and nothing else.
 *
 * Costs no database read: the session cookie is HMAC-signed, so
 * verifySessionToken already establishes that the id is genuine. That is
 * deliberate — the lesson page is the page incident №1 happened on, and
 * adding a second user lookup to it to name a storage key would be a poor
 * trade.
 */
export async function getRecordingsOwnerScope(): Promise<string> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return ANONYMOUS_OWNER_SCOPE;

  const parsed = verifySessionToken(token);
  if (!parsed) return ANONYMOUS_OWNER_SCOPE;

  return ownerScopeFor(parsed.userId);
}

/** Split out so the profile page (which already has the user in hand) and
 * the lesson page (which does not) produce the same scope for the same
 * account — otherwise the profile's usage figure would describe a
 * different bucket than the one the lesson writes to. */
export function ownerScopeFor(userId: string): string {
  return createHash("sha256")
    .update(`${process.env.SESSION_SECRET ?? ""}:voice-recordings:${userId}`)
    .digest("hex")
    .slice(0, 16);
}
