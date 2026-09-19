"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import type { Locale } from "@/i18n/config";
import { clearDeliveredNotifications, scheduleStreakReminder } from "@/lib/notifications";

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

  /**
   * ДОЛГ 203: БЕЙДЖ СНИМАЕТСЯ И ТОГДА, КОГДА ПРИЛОЖЕНИЕ ОТКРЫЛИ С ИКОНКИ.
   *
   * До этой правки бейдж убирало только нажатие на САМО уведомление
   * (`autoCancel` плагина). Открыл человек приложение с иконки — значок
   * с числом оставался висеть, потому что на возобновление не был
   * подписан никто: вызовов `removeAllDeliveredNotifications()` во всём
   * `src/` было 0.
   *
   * Два места, а не одно, и оба нужны: `resume` не приходит на ПЕРВЫЙ
   * запуск (приложение не возобновлялось, оно стартовало), а один вызов
   * на монтировании не увидит второго и третьего возвращения.
   *
   * Отдельный эффект с пустым списком зависимостей: подписка не должна
   * пересоздаваться при смене языка или входе в учётную запись — иначе
   * на каждую смену вешался бы ещё один слушатель.
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void clearDeliveredNotifications();
    const handle = App.addListener("resume", () => {
      void clearDeliveredNotifications();
    });
    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, []);

  return null;
}
