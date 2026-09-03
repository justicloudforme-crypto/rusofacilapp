import "server-only";
import { db } from "./db";
import { DEFAULT_TIME_ZONE, dateKeyIn } from "./timezone";
import { studyDayKeyIn } from "./study-day-key";
import { invalidateActivityDateKeys } from "./activity-cache";

// The day mark: "this learner studied today".
//
// ── Why this file exists ──────────────────────────────────────────────
//
// Before it, a day counted only if a progress ROW moved: an exercise
// checked, a card answered, a story page turned, a puzzle finished, an exam
// submitted. Opening the lesson, reading the story, looking through the
// cards — none of it left a trace. Verified in a real browser on
// 31.08.2026, logged in as a real account, eight page loads across both
// locales: zero rows moved, and the streak still pointed at 27.08.
//
// The rule now is the one the owner stated: a day counts for a SUBSTANTIVE
// ACTION — opening a lesson, a story, a game, the cards or an exam — on
// either locale, for any signed-in learner. Opening the profile alone is
// not one, which is why /profile does not call anything in this file.
//
// ── Where the day boundary comes from ────────────────────────────────
//
// src/lib/timezone.ts, and nowhere else. There is no second implementation
// of "what day is it" in this file on purpose: two of them is precisely the
// defect fixed on 31.08.2026 (PROGRESS.md 7.68).

/** The surfaces that count as study. Kept as a closed union so adding one
 * is a deliberate edit here, not an ad-hoc string at a call site.
 *
 * "media" joined on 31.08.2026 by the owner's decision: a song or a grammar
 * video is study, and it was the last substantive surface that gave no day.
 * Nothing about the column changed — `source` is a plain String, so a new
 * member costs no migration. */
export type StudyDaySource = "lesson" | "story" | "flashcards" | "word-game" | "exam" | "media";

/** Records that `userId` studied on the calendar day `at` falls on, as seen
 * in `timeZone`.
 *
 * Idempotent by construction, not by convention: the row is keyed on
 * (userId, dateKey) with a unique index, and a day already marked is left
 * exactly as it is. Marking the same day a second time — a re-render, a refresh, a
 * back-navigation, two tabs — writes nothing new and keeps the FIRST
 * source. Proved directly in study-day.test.ts and against a real database
 * in scripts/scenarios.
 *
 * Fail-soft on purpose. This runs inside after(), behind a page that has
 * already been sent; a database hiccup must cost the learner a day mark, at
 * worst, never the page. The same reasoning as persistFreezeState. It is
 * also what keeps the deploy safe in the window between the code going live
 * and prisma/ensure-schema-sync.ts creating the table: "no such table" is
 * caught here rather than thrown into a render.
 */
export async function markStudyDay(
  userId: string,
  timeZone: string,
  source: StudyDaySource,
  at: Date = new Date(),
): Promise<void> {
  const dateKey = dateKeyIn(at, timeZone);
  try {
    // Read first, and on the overwhelmingly common path (the day is already
    // marked — every page view after the first one) stop there: one indexed
    // lookup, no write at all. An upsert would issue a write on every
    // single lesson, story, card and puzzle view for nothing.
    const existing = await db.studyDay.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
      select: { id: true, markedAt: true },
    });
    if (existing) {
      const belongsTo = studyDayKeyIn({ dateKey, markedAt: existing.markedAt }, timeZone);
      if (belongsTo === dateKey) return; // the ordinary case: today is marked

      // The row sitting on today's key was written for another day: it was
      // stamped in a zone the server did not know at the time — UTC on a
      // first page load — and for an evening learner west of Greenwich that
      // is TOMORROW's key. Left alone it does two things at once: it hides
      // the day it really belongs to, and it blocks the mark for today,
      // because the unique index has no room for a second row.
      //
      // So it is moved to its own day, and today is then marked normally.
      // Nothing is invented here: the day it moves to is the one its own
      // instant names, in the zone we now know.
      const occupied = await db.studyDay.findUnique({
        where: { userId_dateKey: { userId, dateKey: belongsTo } },
        select: { id: true },
      });
      if (occupied) {
        // That day is already marked by a row of its own, so this one is a
        // duplicate of it and nothing is lost by removing it. This is the
        // only delete in the day-mark path, and it can only ever run when
        // the day it would preserve is already on the calendar.
        await db.studyDay.delete({ where: { id: existing.id } });
      } else {
        await db.studyDay.update({ where: { id: existing.id }, data: { dateKey: belongsTo } });
      }
    }

    // `markedAt` is written explicitly rather than left to the column
    // default, because it is no longer bookkeeping: the reader derives the
    // calendar day from it (src/lib/study-day-key.ts). Defaulting to now()
    // would be identical in production — `at` IS now — and wrong for every
    // caller that passes an instant, which is how the scenarios plant days.
    await db.studyDay.create({ data: { userId, dateKey, source, markedAt: at } });

    // Only ever reached when the day really was new, i.e. at most once a
    // day per learner. Without it the streak lags the learner by up to the
    // cache's 60 seconds: they open their first lesson of the day, the
    // flame does not light, and the reasonable conclusion is that opening a
    // lesson still does not count — which is the very complaint this
    // change set answers.
    await invalidateActivityDateKeys(userId, timeZone);
  } catch (error) {
    // Includes the one race this design has: two requests arriving in the
    // same millisecond both find nothing and both insert. The unique index
    // rejects the loser, which is exactly the right outcome — one row for
    // the day — so it is logged and dropped, not retried.
    console.error("markStudyDay failed", error);
  }
}

/** Every marked day of this learner, as `{ dateKey, source }`. Degrades to
 * an empty list rather than throwing (see 7.24): the streak still has its
 * five derived sources, so a missing table costs accuracy, not the profile
 * page. */
export async function getStudyDayRows(
  userId: string,
): Promise<Array<{ dateKey: string; source: string; markedAt: Date | null }>> {
  try {
    // `markedAt` comes along because the day a mark belongs to is derived
    // from the instant in the READER's zone, not read off the stored key —
    // see src/lib/study-day-key.ts for why.
    return await db.studyDay.findMany({
      where: { userId },
      select: { dateKey: true, source: true, markedAt: true },
    });
  } catch (error) {
    console.error("getStudyDayRows failed", error);
    return [];
  }
}

/** Just the keys, for callers that only need the calendar. Derived in
 * `timeZone` for the same reason streaks.ts derives them there — see
 * src/lib/study-day-key.ts. */
export async function getStudyDayKeys(
  userId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<string[]> {
  return (await getStudyDayRows(userId)).map((row) => studyDayKeyIn(row, timeZone));
}
