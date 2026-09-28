"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import Switch from "@/components/ui/Switch";
import type { NativeAccessCopy } from "@/lib/native-access-copy";
import {
  REMINDER_CHOICE_KEY,
  cancelStreakReminder,
  enableStreakReminder,
  notificationPermissionGranted,
} from "@/lib/notifications";
import { readLocal, writeLocal } from "@/lib/safe-storage";

/**
 * ПЕРЕКЛЮЧАТЕЛЬ НАПОМИНАНИЯ — заход 7.243 (аудит 7.241, Р11).
 *
 * Единственное место, откуда приложение спрашивает разрешение на
 * уведомления: человек включает напоминание сам, строкой выше он прочёл,
 * зачем оно и что сейчас спросит телефон. При запуске вопроса нет
 * (`NativeNotifications`), после отказа — тоже: повторно окно появится
 * только от нового нажатия здесь.
 */
export default function ReminderSetting({
  lang,
  userId,
  copy,
}: {
  lang: Locale;
  userId: string;
  copy: NativeAccessCopy["reminder"];
}) {
  const [on, setOn] = useState<boolean | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let live = true;
    void notificationPermissionGranted().then((granted) => {
      if (live) setOn(granted && readLocal(REMINDER_CHOICE_KEY) !== "off");
    });
    return () => {
      live = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    setDenied(false);
    if (!next) {
      writeLocal(REMINDER_CHOICE_KEY, "off");
      await cancelStreakReminder();
      setOn(false);
      return;
    }
    const granted = await enableStreakReminder(lang, userId);
    writeLocal(REMINDER_CHOICE_KEY, granted ? "on" : "off");
    setOn(granted);
    setDenied(!granted);
  };

  return (
    <div className="mt-6 rounded-2xl border border-foreground/10 p-5 sm:p-6" data-rf-reminder>
      <h2 className="font-serif text-lg font-semibold text-foreground">{copy.heading}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/70">{copy.body}</p>
      <Switch
        className="mt-3"
        label={copy.label}
        checked={on === true}
        disabled={on === null}
        onChange={(event) => void toggle(event.target.checked)}
      />
      {denied ? (
        <p role="status" className="mt-2 text-sm leading-6 text-foreground/70">
          {copy.denied}
        </p>
      ) : null}
    </div>
  );
}
