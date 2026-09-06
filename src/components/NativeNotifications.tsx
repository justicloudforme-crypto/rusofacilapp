"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import type { Locale } from "@/i18n/config";
import { scheduleStreakReminder } from "@/lib/notifications";

/**
 * Requests local-notification permission and (re-)schedules the daily
 * daily reminder once per native app launch. `lang` picks the locale of
 * the text and `userId` the position in the rotation, so two learners on
 * the same evening do not get the same sentence and the same learner does
 * not get it twice in a row (src/lib/notification-copy.ts). No-op on web — mirrors
 * NativeBackButtonHandler.tsx's mount-a-null-component convention so the
 * root layout doesn't need any platform branching of its own.
 */
export default function NativeNotifications({
  lang,
  userId,
}: {
  lang: Locale;
  userId: string | null;
}) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void scheduleStreakReminder(lang, userId);
  }, [lang, userId]);

  return null;
}
