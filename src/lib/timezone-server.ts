import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_TIME_ZONE, TIMEZONE_COOKIE, isValidTimeZone } from "./timezone";

/** The zone to compute a signed-in user's day boundary in.
 *
 * Two sources, in this order, and the order matters:
 *
 * 1. `User.timezone` — written by POST /api/timezone from the browser.
 *    Authoritative because it is attached to the ACCOUNT, so badge
 *    evaluation (which runs in after(), with no request of its own to read
 *    a cookie from) and a public profile (rendered for a VISITOR, whose
 *    cookie is the visitor's zone, not the profile owner's) both get the
 *    right answer.
 * 2. the `rusofacil-tz` cookie — covers the first render after login,
 *    before the column is filled in, and anonymous surfaces.
 *
 * Falls back to UTC, which is what every call site did unconditionally
 * before 31.08.2026. */
export async function getRequestTimeZone(userTimeZone?: string | null): Promise<string> {
  if (isValidTimeZone(userTimeZone)) return userTimeZone;
  const store = await cookies();
  const fromCookie = store.get(TIMEZONE_COOKIE)?.value;
  return isValidTimeZone(fromCookie) ? fromCookie : DEFAULT_TIME_ZONE;
}
