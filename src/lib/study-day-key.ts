import { dateKeyIn } from "./timezone";

// Which calendar day a StudyDay row belongs to, as the learner sees it NOW.
//
// ── Why this is not simply `row.dateKey` ──────────────────────────────
//
// The stored key is stamped at WRITE time, in whatever zone the server knew
// about at that moment (src/lib/timezone-server.ts). On the request that has
// neither `User.timezone` filled in nor the `rusofacil-tz` cookie yet — a
// brand-new browser's very first page load, a cleared WebView, a client that
// never runs the script that writes the cookie — that zone is UTC. For a
// learner in Mexico City studying at 19:00 that is 01:00 the NEXT day, so
// the mark lands on TOMORROW: the day they actually studied is missing from
// the calendar and a day they did not study carries a flame. Measured as a
// unit test in study-day-key.test.ts.
//
// The other FIVE sources of the streak never had this problem, because they
// store an instant and streaks.ts converts it in the reader's zone every
// time. StudyDay was the one source frozen at write time, which also meant a
// learner who changes zone got five sources on the new calendar and one on
// the old — a mixture that can open a hole no single zone would have.
//
// So the rule is the one the other five already follow: the instant is the
// fact, the day is a view of it. `markedAt` has been on the row since the
// table shipped (prisma/schema.prisma), so nothing has to be backfilled;
// `dateKey` stays exactly as it is, because it is what makes the mark
// idempotent per day at write time (the unique index) and because it is the
// only answer left for a row whose `markedAt` is somehow unusable.
//
// The trade-off, stated rather than hidden: a learner who moves zone sees
// their past days shift by the difference. That is already true of every
// other source, and one calendar the whole account agrees on is worth more
// than a mixture of two.

/** The day this mark belongs to, in `timeZone`.
 *
 * Falls back to the stored key — never throws, never returns an empty
 * string: a day mark that cannot be placed is still a day the learner
 * studied, and dropping it would be a worse answer than placing it where it
 * was placed when it was written. */
export function studyDayKeyIn(
  row: { dateKey: string; markedAt?: Date | string | null },
  timeZone: string,
): string {
  const raw = row.markedAt;
  if (raw === null || raw === undefined) return row.dateKey;
  const at = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(at.getTime())) return row.dateKey;
  return dateKeyIn(at, timeZone);
}
