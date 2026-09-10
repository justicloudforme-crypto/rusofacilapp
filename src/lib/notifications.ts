"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { Locale } from "@/i18n/config";
import { pickNotificationCopy } from "./notification-copy";
import { dateKeyIn } from "./timezone";

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
 * Schedules (or re-schedules) the daily reminder. `hour`/`minute` are in
 * the device's local time. No-op on web and if permission hasn't been
 * granted.
 *
 * Neither the time nor the frequency changed on 05.09.2026: still one
 * notification, still 19:00 device-local, still `repeats: true` under the
 * one fixed id, so a re-schedule replaces the previous one instead of
 * stacking. What changed is the TEXT — it now comes from a rotation keyed
 * on (learner, day) and it is written in the interface language instead of
 * always Spanish (src/lib/notification-copy.ts).
 *
 * The limitation, stated rather than hidden: the OS owns the repeat, so a
 * device whose app is not opened for a week repeats the text that was
 * scheduled last. Rotation advances whenever the app is launched, which is
 * every launch (NativeNotifications.tsx). Scheduling several days ahead as
 * separate notifications would advance it without a launch, but it would
 * also turn a reminder that repeats forever into one that stops after N
 * days on a device that goes quiet — a worse trade, and it would change
 * the schedule, which this pass is not allowed to do.
 */
export async function scheduleStreakReminder(
  locale: Locale,
  userId: string | null,
  hour = 19,
  minute = 0,
): Promise<void> {
  const granted = await requestNotificationPermission();
  if (!granted) return;

  // The learner's own calendar day, in the device's zone — the same rule
  // every other day-shaped value on this site follows (PROGRESS.md 7.68).
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { title, body } = pickNotificationCopy(locale, userId, dateKeyIn(new Date(), timeZone));

  await nativeOnly(() =>
    LocalNotifications.schedule({
      notifications: [
        {
          id: STREAK_REMINDER_ID,
          title,
          body,
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          // ТОЧНЫЙ БУДИЛЬНИК НЕ ПРОСИТСЯ, И ЭТО ПРАВКА 09.09.2026 (долг 107).
          //
          // `isExactNotification` у плагина по умолчанию **true**, и это не
          // безобидная умолчалка. Прочитано в
          // `node_modules/@capacitor/local-notifications/android/src/main/kotlin/…/LocalNotificationsPlugin.kt`:
          // на `schedule()` при API 31+ плагин, не имея права на точный
          // будильник, ОТКРЫВАЕТ СИСТЕМНЫЙ ЭКРАН «Alarms & reminders»
          // (`startActivityForResult(ACTION_REQUEST_SCHEDULE_EXACT_ALARM)`) —
          // независимо от `isExactMandatory`. А планируем мы на каждом
          // запуске приложения (`NativeNotifications.tsx`). То есть с
          // разрешением, которого Google Play не даёт приложениям, не
          // являющимся будильником, ученик получал бы системные настройки в
          // лицо при старте.
          //
          // `false` — «планировать неточно сразу, независимо от состояния
          // разрешения» (так это и описано в definitions.d.ts). Для
          // ежедневного напоминания в 19:00 неточность в пределах окна
          // системы значения не имеет, а разрешение
          // `SCHEDULE_EXACT_ALARM` после этого не нужно вовсе — оно
          // вырезано из манифеста `tools:node="remove"`.
          //
          // `allowWhileIdle` остаётся: `setAndAllowWhileIdle` разрешения
          // не требует (LocalNotificationManager.kt, ветка `else` в
          // `setExactIfPossible`), а без него напоминание молчало бы в
          // режиме Doze.
          isExactNotification: false,
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
