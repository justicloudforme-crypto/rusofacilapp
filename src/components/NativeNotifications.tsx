"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { scheduleStreakReminder } from "@/lib/notifications";

/**
 * Requests local-notification permission and (re-)schedules the daily
 * streak reminder once per native app launch. No-op on web — mirrors
 * NativeBackButtonHandler.tsx's mount-a-null-component convention so the
 * root layout doesn't need any platform branching of its own.
 */
export default function NativeNotifications() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void scheduleStreakReminder();
  }, []);

  return null;
}
