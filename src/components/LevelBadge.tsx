import type { FlashcardLevel } from "@/lib/flashcards/types";

// Warm-to-cool progression, A1 (easiest) to C1 (hardest) — reads as a
// difficulty ramp at a glance instead of every level sharing the same
// neutral gray pill. Each pair is tuned to stay legible on both the cream
// light background and the dark theme's near-black one.
const LEVEL_COLORS: Record<FlashcardLevel, string> = {
  A1: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  A2: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  B1: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  B2: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  C1: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export default function LevelBadge({ level, className = "" }: { level: FlashcardLevel; className?: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${LEVEL_COLORS[level]} ${className}`}
    >
      {level}
    </span>
  );
}
