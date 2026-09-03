// The day boundary of anything a learner sees ("day 5 in a row", the
// activity heatmap) has to be THEIR midnight, not the server's.
//
// Before 31.08.2026 every activity date key came from `Date#toISOString`,
// i.e. UTC. For the owner's own account (America/Tijuana, UTC-7) that
// silently rewrote history: an evening session at 19:31 local is 02:31 the
// NEXT day in UTC, so one calendar day of study could land on the next
// UTC day, merge with it, and leave the real day empty. Measured on the
// owner's real rows: 12 consecutive study days in Tijuana became at most 7
// under UTC, and two whole days disappeared. See PROGRESS.md 7.68.
//
// Nothing here is server-only on purpose: the client component that
// reports the browser's zone needs the cookie name and the validator too.

/** Cookie the browser writes with its own IANA zone, read server-side on
 * the very first render so a signed-out visitor (and a signed-in one whose
 * User.timezone is not filled in yet) still gets their own midnight. */
export const TIMEZONE_COOKIE = "rusofacil-tz";

/** The zone Vercel attaches to every incoming request, derived from its IP
 * (documented platform header, present on preview and production; absent in
 * `next dev`, where the fallback chain simply carries on to UTC). Read
 * server-side only — see src/lib/timezone-server.ts for why it sits third
 * behind the account column and the cookie. */
export const VERCEL_TIMEZONE_HEADER = "x-vercel-ip-timezone";

/** What every reader falls back to when the user's zone is unknown. This
 * is the OLD behaviour, kept deliberately as the fallback: it can be
 * wrong, but it is never inconsistent between two readers. */
export const DEFAULT_TIME_ZONE = "UTC";

/** True only for a zone name Intl actually knows.
 *
 * The value arrives from a cookie and from a request body, i.e. from
 * outside, and is passed straight to Intl.DateTimeFormat — an unchecked
 * value throws a RangeError at render time. The length cap is there so a
 * megabyte of junk never reaches Intl at all. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  // Intl accepts "utc" and other odd casings; restricting the shape first
  // keeps the stored value canonical-looking and rejects anything that is
  // clearly not a zone name before it reaches the (slower) Intl check.
  if (!/^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" for the given instant AS SEEN IN `timeZone`.
 *
 * Built from formatToParts rather than a locale that happens to format
 * ISO-first ("en-CA"): locale data is not a contract, and a wrong order
 * here would not throw — it would quietly produce keys that never compare
 * equal to each other, i.e. a streak of 1 forever. An unknown zone falls
 * back to UTC instead of throwing, so a bad stored value can never take a
 * page down (the failure mode this replaces was a *display* bug; making it
 * a 500 would be a worse one).
 */
export function dateKeyIn(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const zone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shifts a "YYYY-MM-DD" key by whole days.
 *
 * Deliberately zone-free arithmetic on the key itself: the key is already
 * a calendar date in the user's zone, and re-entering a zone here would
 * make "yesterday" ambiguous across a DST change. Anchoring at noon UTC
 * (not midnight) keeps the ±1 step exact for every offset in use. */
export function addDateKeyDays(dateKey: string, delta: number): string {
  const shifted = new Date(Date.parse(`${dateKey}T12:00:00.000Z`) + delta * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}
