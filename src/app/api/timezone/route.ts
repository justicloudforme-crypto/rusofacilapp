import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRateLimiter } from "@/lib/rate-limit";
import { isValidTimeZone } from "@/lib/timezone";

// Called by <TimeZoneSync> once per browser, and again only if the
// browser's zone actually changes (travel, a device with the wrong clock
// corrected). It is not a preference the user sets — it is the answer to
// "where is this learner's midnight", which the streak counter needs and
// the server cannot know on its own.
//
// Rate-limited like every other write: the client is supposed to call this
// at most once per session, so anything beyond a handful a minute is a
// client bug or an abusive caller, not normal use.
const timezoneLimiter = getRateLimiter("timezone", 60_000, 10);

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    // Anonymous visitors still get their own day boundary — from the
    // cookie <TimeZoneSync> writes itself. There is simply no account to
    // attach it to, so this is a no-op rather than an error.
    return NextResponse.json({ ok: true, stored: false });
  }

  if (await timezoneLimiter.check(user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const timezone = (body as { timezone?: unknown } | null)?.timezone;
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }

  // Skip the write when nothing changed: this route is reachable on every
  // first page load of a session, and an unconditional UPDATE would be a
  // write per session per user for a value that almost never changes.
  if (user.timezone !== timezone) {
    await db.user.update({ where: { id: user.id }, data: { timezone } });
  }

  return NextResponse.json({ ok: true, stored: true });
}
