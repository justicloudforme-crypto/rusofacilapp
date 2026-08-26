"use client";

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// No-op on web (mirrors src/lib/revenuecat-client.ts's guard convention) —
// the Haptics plugin throws "not implemented" if called outside a native
// shell, and this app's browser build has no vibration UX to begin with.
function nativeOnly(fn: () => Promise<void>): void {
  if (!Capacitor.isNativePlatform()) return;
  fn().catch(() => {
    // Best-effort feedback only — never let a haptics failure surface as a
    // user-visible error or interrupt the action it's attached to.
  });
}

/** Light tap — routine button presses (nav, toggles, answer submission). */
export function hapticTap(): void {
  nativeOnly(() => Haptics.impact({ style: ImpactStyle.Light }));
}

/** Success buzz — correct answer, lesson/topic passed, streak milestone. */
export function hapticSuccess(): void {
  nativeOnly(() => Haptics.notification({ type: NotificationType.Success }));
}

/** Error buzz — wrong answer, failed lesson check. */
export function hapticError(): void {
  nativeOnly(() => Haptics.notification({ type: NotificationType.Error }));
}
