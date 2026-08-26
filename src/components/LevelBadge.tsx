import type { FlashcardLevel } from "@/lib/flashcards/types";

// Warm-to-cool progression, A1 (easiest) to C1 (hardest) — reads as a
// difficulty ramp at a glance instead of every level sharing the same
// neutral gray pill. Now driven by tokens.json's color.level scale (muted
// on purpose so none of the 5 compete visually with primary) instead of
// raw Tailwind emerald/teal/amber/orange/rose — "strong" is AA-verified
// (>=6.4:1, see scripts/check-tokens.mjs) against its own "default/15" tint.
const LEVEL_COLORS: Record<FlashcardLevel, string> = {
  A1: "bg-level-a1-default/15 text-level-a1-strong dark:text-level-a1-default",
  A2: "bg-level-a2-default/15 text-level-a2-strong dark:text-level-a2-default",
  B1: "bg-level-b1-default/15 text-level-b1-strong dark:text-level-b1-default",
  B2: "bg-level-b2-default/15 text-level-b2-strong dark:text-level-b2-default",
  C1: "bg-level-c1-default/15 text-level-c1-strong dark:text-level-c1-default",
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
