import "server-only";
import { after } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "./session-token";
import { getRequestTimeZone } from "./timezone-server";
import { markStudyDay, type StudyDaySource } from "./study-day";

// The one line a study page adds so that opening it counts as a study day.
//
// Kept apart from study-day.ts so the data module stays free of Next's
// request APIs: streaks.ts imports that one, and nothing that computes a
// streak should drag `after`/`cookies` in behind it.

/** Marks today as a study day for whoever is signed in, and does nothing at
 * all for a signed-out visitor.
 *
 * Call it from the page's Server Component body — not from a client
 * component, and not from an API route. The rule is that OPENING the page
 * is the study action, and a mark that needs JavaScript to fire is a mark a
 * slow phone, a dead battery or an ad blocker can lose.
 *
 * **Costs no database read to identify the learner.** The session cookie is
 * HMAC-signed, so verifySessionToken already establishes that the id is
 * genuine, and that is all a day mark needs. This is the same trade
 * getRecordingsOwnerScope makes, for the same reason: the lesson page is
 * the page incident №1 happened on, and putting a second `SELECT * FROM
 * User` on every lesson, story, game and card view to write one row would
 * be a poor bargain. The one thing skipped is the sessionVersion check, so
 * a browser holding a revoked session could still mark its own day; the
 * cost of that is one row on the learner's own account, and the row is
 * still impossible to create for a deleted account (foreign key).
 *
 * A page that already has the User row in hand should pass it: the zone
 * stored on the account beats the cookie, and passing it is free.
 *
 * The write itself is deferred with after(), so the response is already on
 * its way to the learner before the database is touched and the mark can
 * never slow a page down. Both cookie reads happen BEFORE that — a Server
 * Component may not touch cookies() or headers() inside after().
 */
export async function markStudyDayVisit(
  source: StudyDaySource,
  user?: { id: string; timezone: string | null } | null,
): Promise<void> {
  const userId = user === undefined ? await signedInUserId() : user?.id ?? null;
  if (!userId) return;
  const timeZone = await getRequestTimeZone(user?.timezone ?? null);
  after(() => markStudyDay(userId, timeZone, source));
}

async function signedInUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token)?.userId ?? null;
}
