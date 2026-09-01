"use client";

import { flashcardCategories, type FlashcardCategory, type FlashcardLevel } from "@/lib/flashcards";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";
import { flashcardCategoryIconColors } from "@/lib/flashcards/category-icon-colors";
import { getNextLevel, shouldSuggestNextLevel } from "@/lib/flashcards/level-progress";
import { hapticTap } from "@/lib/haptics";
import ProgressBar from "@/components/ui/ProgressBar";
import type { CategorySummary } from "@/lib/flashcards/summary-client";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";

export type { CategorySummary } from "@/lib/flashcards/summary-client";

export interface CategoryGridDict {
  /** Carried in the dict rather than as a prop because every dict here is
   * built once, in the one component that has the locale, and passed down
   * whole. Any label that has to agree with a number needs it. */
  locale: Locale;
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: PluralForms; // templates, contain literal "{count}"
  nextLevelBadgeLabel: string; // template, contains literal "{level}"
}

export default function CategoryGrid({
  dict,
  summary,
  hasAnyProgress = true,
  levelFilter,
  onSelectCategory,
}: {
  dict: CategoryGridDict;
  summary: Record<string, CategorySummary>;
  // False only for a visitor with zero recorded progress anywhere (brand
  // new guest, nothing ever marked known) — an empty bar on every single
  // tile reads as broken, not "0%", so the whole grid shows card counts
  // only until there's real signal to plot. Once any card is known
  // anywhere, real per-category bars appear, including honest 0% for
  // categories not yet touched (a legitimate value, not a placeholder).
  hasAnyProgress?: boolean;
  // "all" (or omitted, for call sites with no level concept) suppresses
  // the next-level nudge below — there's no single current level to
  // suggest moving on from.
  levelFilter?: FlashcardLevel | "all";
  onSelectCategory: (category: FlashcardCategory) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {flashcardCategories.map((category) => {
          const stat = summary[category];
          const total = stat?.total ?? 0;
          const known = stat?.known ?? 0;
          const percent = total === 0 ? 0 : Math.round((known / total) * 100);
          const nextLevel =
            levelFilter && levelFilter !== "all" && shouldSuggestNextLevel(levelFilter, known, total)
              ? getNextLevel(levelFilter)
              : null;

          return (
            <button
              key={category}
              type="button"
              onClick={() => {
                hapticTap();
                onSelectCategory(category);
              }}
              className="tap relative flex flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
            >
              {nextLevel && (
                <span
                  title={dict.nextLevelBadgeLabel.replace("{level}", nextLevel)}
                  className="absolute right-2 top-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                >
                  → {nextLevel}
                </span>
              )}
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${flashcardCategoryIconColors[category]}`}
                aria-hidden
              >
                {flashcardCategoryIcons[category]}
              </span>
              <span className="text-sm font-medium leading-snug">{dict.categoryLabels[category]}</span>
              <span className="text-xs text-foreground/50">{plural(dict.locale, total, dict.cardCountLabel, { count: total })}</span>
              {hasAnyProgress && (
                <ProgressBar percent={percent} tone="success" className="mt-1 w-full" ariaLabel={dict.categoryLabels[category]} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
