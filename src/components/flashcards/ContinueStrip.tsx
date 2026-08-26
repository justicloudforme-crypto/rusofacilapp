"use client";

import type { FlashcardCategory } from "@/lib/flashcards";
import type { RecentCategory } from "@/lib/flashcards/summary-client";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";
import { flashcardCategoryIconColors } from "@/lib/flashcards/category-icon-colors";
import { hapticTap } from "@/lib/haptics";
import ProgressBar from "@/components/ui/ProgressBar";

export interface ContinueStripDict {
  continueTitle: string;
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: string; // template, contains literal "{count}"
}

/** Up to 3 most-recently-studied categories, from POST /api/flashcards/
 * summary's `recent` (real FlashcardProgress/local-progress activity, no
 * new metric) — lets a returning visitor jump back into where they left
 * off instead of re-picking from all 23 categories every time. Reuses the
 * same tile look as CategoryGrid's own cards, just above the grid. */
export default function ContinueStrip({
  dict,
  recent,
  onSelectCategory,
}: {
  dict: ContinueStripDict;
  recent: RecentCategory[];
  onSelectCategory: (category: FlashcardCategory) => void;
}) {
  if (recent.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/50">{dict.continueTitle}</h2>
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
        {recent.map((item) => {
          const percent = item.total === 0 ? 0 : Math.round((item.known / item.total) * 100);
          return (
            <button
              key={item.category}
              type="button"
              onClick={() => {
                hapticTap();
                onSelectCategory(item.category);
              }}
              className="tap flex w-48 shrink-0 flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/10 sm:w-auto"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${flashcardCategoryIconColors[item.category]}`}
                aria-hidden
              >
                {flashcardCategoryIcons[item.category]}
              </span>
              <span className="text-sm font-medium leading-snug">{dict.categoryLabels[item.category]}</span>
              <span className="text-xs text-foreground/50">
                {item.known}/{item.total} · {percent}%
              </span>
              <ProgressBar percent={percent} tone="success" className="w-full" ariaLabel={dict.categoryLabels[item.category]} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
