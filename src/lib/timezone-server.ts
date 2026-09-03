import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_TIME_ZONE, TIMEZONE_COOKIE, VERCEL_TIMEZONE_HEADER, isValidTimeZone } from "./timezone";

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
 * 3. `x-vercel-ip-timezone`, the zone Vercel derives from the request's own
 *    IP. Added 02.09.2026, and it covers the one gap the first two cannot:
 *    the VERY FIRST page load of a new browser. The cookie is written by a
 *    client effect (src/components/TimeZoneSync.tsx), so it does not exist
 *    yet while that first response is being rendered — and that is the
 *    response that marks the learner's first study day. In Mexico City at
 *    19:00 the UTC fallback stamps that mark on TOMORROW. The header is on
 *    the request itself, so it is there before any JavaScript has run.
 *
 *    Third and not first on purpose: an IP says where the connection comes
 *    from, not where the person is (a VPN, a roaming phone, an office
 *    tunnel), so it is the answer used only when nobody better has spoken.
 *
 * Falls back to UTC, which is what every call site did unconditionally
 * before 31.08.2026. */
export async function getRequestTimeZone(userTimeZone?: string | null): Promise<string> {
  if (isValidTimeZone(userTimeZone)) return userTimeZone;
  const store = await cookies();
  const fromCookie = store.get(TIMEZONE_COOKIE)?.value;
  if (isValidTimeZone(fromCookie)) return fromCookie;
  const fromEdge = (await headers()).get(VERCEL_TIMEZONE_HEADER);
  return isValidTimeZone(fromEdge) ? fromEdge : DEFAULT_TIME_ZONE;
}
