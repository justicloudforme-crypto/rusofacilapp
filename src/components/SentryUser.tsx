"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Puts the signed-in user's id on every browser event Sentry sends.
 *
 * Why this was worth adding. Every issue on the board reads "Users 0",
 * because the `user` field has never been set on a single event — server or
 * browser. That number is not "nobody was affected", it is "nobody was
 * identified", and the two are indistinguishable from the dashboard. It
 * cost real time on 31.08.2026: the blast radius of three separate
 * production issues had to be reconstructed from release hashes,
 * transaction names and timestamps, because the one field that answers "how
 * many people" directly was empty. The next incident should be countable in
 * people, not inferred.
 *
 * The id and nothing else. No email, no name, no IP — an opaque cuid that
 * means something only against our own database, which is the least that
 * still answers "how many distinct people hit this". The Privacy Policy
 * (src/lib/legal/content.ts) describes what each processor receives, and
 * this keeps Sentry's answer to "personal data" as small as it can be while
 * still being useful.
 *
 * `setUser(null)` on sign-out matters as much as setting it: without it the
 * previous account's id would stay attached to the scope for the rest of
 * the tab's life and file the next person's errors under the last person's
 * id.
 */
export default function SentryUser({ userId }: { userId: string | null }) {
  useEffect(() => {
    Sentry.setUser(userId ? { id: userId } : null);
  }, [userId]);

  return null;
}
