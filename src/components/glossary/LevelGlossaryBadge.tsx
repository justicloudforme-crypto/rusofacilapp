"use client";

import { useLevelGlossaryProgress } from "@/lib/useLevelGlossaryProgress";

export interface LevelGlossaryBadgeDict {
  /** Shown once every term for the level is mastered, e.g. "Vocabulario gramatical dominado". */
  completeLabel: string;
  /** Shown while in progress, with {count}/{total} placeholders, e.g. "{count}/{total} dominados". */
  progressLabel: string;
}

/**
 * Glossary-mastery indicator for a level card on /courses. Two states:
 *  - in progress: a compact "7/19 dominados" readout with a thin fill bar,
 *    so the student sees the climb instead of a binary badge that only
 *    appears at 100% (the original version did that, and the user pointed
 *    out it gave no feedback for the long stretch before completion).
 *  - complete: the emerald checkmark pill.
 * Data comes from useLevelGlossaryProgress (shared with the /courses/[level]
 * page's progress bar) — no per-component fetch/recompute here anymore.
 */
export default function LevelGlossaryBadge({ level, dict }: { level: string; dict: LevelGlossaryBadgeDict }) {
  const { mastered, total } = useLevelGlossaryProgress(level);

  if (mastered === null || total === null || total === 0) return null;

  if (mastered >= total) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414l2.793 2.792 6.793-6.793a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {dict.completeLabel}
      </span>
    );
  }

  const pct = Math.round((mastered / total) * 100);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-xs font-medium text-foreground/50">
        {dict.progressLabel.replace("{count}", String(mastered)).replace("{total}", String(total))}
      </span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </span>
    </span>
  );
}
