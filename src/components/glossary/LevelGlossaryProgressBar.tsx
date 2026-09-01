"use client";

import { useEffect } from "react";
import { useLevelGlossaryProgress } from "@/lib/useLevelGlossaryProgress";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";

export interface LevelGlossaryProgressDict {
  /** "{count}/{total} dominados" */
  locale: Locale;
  /** Agrees with {total} — the number it stands next to. */
  progressLabel: PluralForms;
  /** Shown once, as a toast, the moment mastery first reaches 100%. */
  celebrationMessage: string;
}

/**
 * Progress bar for the level page (/courses/[level]) — the student's
 * "home base" while working through a level, so the same glossary-mastery
 * signal shown as a compact badge on /courses gets a fuller, always-visible
 * treatment here. Shares useLevelGlossaryProgress with LevelGlossaryBadge —
 * one source of truth for the underlying count, two presentations.
 */
export default function LevelGlossaryProgressBar({
  level,
  dict,
}: {
  level: string;
  dict: LevelGlossaryProgressDict;
}) {
  const { mastered, total, justCompleted, dismissCelebration } = useLevelGlossaryProgress(level);

  useEffect(() => {
    if (!justCompleted) return;
    const timer = setTimeout(dismissCelebration, 5000);
    return () => clearTimeout(timer);
  }, [justCompleted, dismissCelebration]);

  if (mastered === null || total === null || total === 0) return null;

  const pct = Math.round((mastered / total) * 100);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <ProgressBar percent={pct} tone="success" className="flex-1" />
        <span className="whitespace-nowrap text-xs font-medium text-foreground/60">
          {plural(dict.locale, total, dict.progressLabel, { count: mastered, total })}
        </span>
      </div>
      {justCompleted && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 transition-opacity dark:text-emerald-400"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414l2.793 2.792 6.793-6.793a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {dict.celebrationMessage}
        </div>
      )}
    </div>
  );
}
