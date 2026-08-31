"use client";

import { useEffect } from "react";
import { TIMEZONE_COOKIE, isValidTimeZone } from "@/lib/timezone";

// Reports the browser's own IANA zone so the server can compute the
// learner's midnight instead of its own. Renders nothing.
//
// Two destinations, because they cover different readers:
//  - a cookie, read on the very next server render (and by anonymous
//    surfaces, which have no account row);
//  - User.timezone via POST /api/timezone, because badge evaluation runs
//    in after() with no request to read a cookie from, and a public
//    profile is rendered for a visitor whose cookie is the wrong person's.
//
// Both writes are skipped when the value already matches, so a returning
// visitor costs nothing beyond one Intl lookup.
export default function TimeZoneSync({ storedTimeZone }: { storedTimeZone: string | null }) {
  useEffect(() => {
    let timezone: string;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!isValidTimeZone(timezone)) return;

    const cookieMatches = document.cookie
      .split("; ")
      .some((pair) => pair === `${TIMEZONE_COOKIE}=${timezone}`);

    if (!cookieMatches) {
      // A year, path=/ so every route sees it, Lax so it rides along on
      // ordinary navigation. Not HttpOnly on purpose — this component has
      // to read it back to know whether it already matches, and the value
      // is not a secret.
      document.cookie = `${TIMEZONE_COOKIE}=${timezone}; path=/; max-age=31536000; samesite=lax`;
    }

    if (storedTimeZone === timezone) return;

    // Fire-and-forget: nothing on the page waits for this, and a failed
    // write just means the next page load tries again. The streak still
    // renders from the cookie in the meantime.
    void fetch("/api/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).catch(() => {});
  }, [storedTimeZone]);

  return null;
}
