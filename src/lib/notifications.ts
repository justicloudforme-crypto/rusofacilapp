"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// Same no-op-on-web convention as src/lib/haptics.ts and
// src/lib/revenuecat-client.ts — the plugin isn't implemented for the
// browser build, and this app has no web notification UX to replace.
function nativeOnly<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve(undefined);
  return fn().catch(() => undefined);
}

// Fixed id for the recurring streak reminder so re-scheduling (e.g. on every
// app launch) safely replaces the previous one instead of stacking
// duplicates — LocalNotifications.schedule() upserts by id.
const STREAK_REMINDER_ID = 1;

/**
 * Asks the user for local-notification permission. Safe to call on every
 * app launch: after the first grant/deny, `requestPermissions()` just
 * returns the already-decided status without showing the OS prompt again.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const result = await nativeOnly(() => LocalNotifications.requestPermissions());
  return result?.display === "granted";
}

/**
 * Schedules (or re-schedules) a daily reminder to keep the user's practice
 * streak going. `hour`/`minute` are in the device's local time. No-op on
 * web and if permission hasn't been granted.
 */
export async function scheduleStreakReminder(hour = 19, minute = 0): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  await nativeOnly(() =>
    LocalNotifications.schedule({
      notifications: [
        {
          id: STREAK_REMINDER_ID,
          title: "¡No pierdas tu racha! 🔥",
          body: "Unos minutos de práctica hoy mantienen vivo tu progreso en ruso.",
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        },
      ],
    }),
  );
}

/** Cancels the streak reminder, e.g. if the user turns reminders off. */
export async function cancelStreakReminder(): Promise<void> {
  await nativeOnly(() =>
    LocalNotifications.cancel({ notifications: [{ id: STREAK_REMINDER_ID }] }),
  );
}
