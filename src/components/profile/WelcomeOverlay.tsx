"use client";

import { useEffect, useState } from "react";
import StreakFlame from "@/components/StreakFlame";

// Shown once per calendar day when the learner lands on their profile
// (the page every post-login redirect and the header's logged-in CTA both
// point at) — gated in localStorage rather than a DB flag, since "have we
// already greeted this user today" doesn't need to survive across devices
// or be queried anywhere else. Reuses the streak stats the profile page
// already fetches for its stat tiles, so this adds no extra data fetching.
export default function WelcomeOverlay({
  userId,
  name,
  currentStreak,
  greeting,
  subtextActive,
  subtextNew,
  streakDaysUnit,
  continueLabel,
}: {
  userId: string;
  name: string | null;
  currentStreak: number;
  greeting: string;
  subtextActive: string;
  subtextNew: string;
  streakDaysUnit: string;
  continueLabel: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `rf-welcome-shown:${userId}:${todayKey}`;
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    } catch {
      // Private-browsing / storage-disabled: just skip the greeting rather
      // than showing it on every single visit.
    }
  }, [userId]);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={greeting}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-6 backdrop-blur-sm dark:bg-black/55"
      onClick={() => setVisible(false)}
    >
      <div
        className="celebration-panel flex max-w-xs flex-col items-center gap-3 rounded-3xl border border-brand/15 bg-background px-8 py-8 text-center shadow-[0_1px_2px_rgba(36,28,21,0.06),0_16px_40px_-12px_rgba(36,28,21,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        {currentStreak > 0 && (
          <StreakFlame days={currentStreak} size={52} label={`${currentStreak} ${streakDaysUnit}`} />
        )}
        <h2 className="font-serif text-xl font-bold text-balance">
          {name?.trim() ? `${greeting.replace(/!$/, "")}, ${name.trim()}!` : greeting}
        </h2>
        <p className="text-sm text-foreground/70">
          {currentStreak > 0 ? subtextActive : subtextNew}
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="tap mt-2 rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-light active:bg-brand-light"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
