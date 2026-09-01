"use client";

import type { FlashcardCategory } from "@/lib/flashcards";
import type { RecentCategory } from "@/lib/flashcards/summary-client";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";
import { flashcardCategoryIconColors } from "@/lib/flashcards/category-icon-colors";
import { hapticTap } from "@/lib/haptics";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Locale } from "@/i18n/config";
import type { PluralForms } from "@/lib/plural";

export interface ContinueStripDict {
  locale: Locale;
  continueTitle: string;
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: PluralForms; // templates, contain literal "{count}"
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
      {/* The same column ladder as CategoryGrid below it, `lg:grid-cols-4`
          included. It stopped at three, so from 1024 up the two blocks on
          one page were a 3-wide row of 200px tiles above a 4-wide grid of
          147px tiles — measured in both locales. They are the same kind of
          tile for the same kind of thing; they now break at the same
          widths. */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4">
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
              // `h-full` + `mt-auto` on the bar is what puts the progress
              // bars of a row on one line: a tile is as tall as the tallest
              // in its row, and without it the bar floated up under a
              // one-line label while its neighbour's sat under two. Measured
              // on /es at 1024 before the change: bars in one grid row at
              // y=818 and y=837, 19px apart.
              className="tap flex h-full w-48 shrink-0 flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30 sm:w-auto"
            >
              {/* Icon, label box and count are the same sizes as
                  CategoryGrid's, so a "Continue" tile and a catalogue tile
                  are the same height — 139px against 151px before this. The
                  two blocks show the same categories on purpose (started
                  ones above, all of them below), which is exactly why they
                  must not be two different-looking things. */}
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${flashcardCategoryIconColors[item.category]}`}
                aria-hidden
              >
                {flashcardCategoryIcons[item.category]}
              </span>
              <span className="min-h-11 text-sm font-medium leading-snug">{dict.categoryLabels[item.category]}</span>
              <span className="text-xs text-foreground/50">
                {item.known}/{item.total} · {percent}%
              </span>
              <ProgressBar percent={percent} tone="success" className="mt-auto w-full pt-1" ariaLabel={dict.categoryLabels[item.category]} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
