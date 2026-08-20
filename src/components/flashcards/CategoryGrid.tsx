"use client";

import { flashcardCategories, type FlashcardCategory, type FlashcardLevel } from "@/lib/flashcards";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";
import { flashcardCategoryIconColors } from "@/lib/flashcards/category-icon-colors";
import { getNextLevel, shouldSuggestNextLevel } from "@/lib/flashcards/level-progress";

export interface CategorySummary {
  total: number;
  known: number;
}

export interface CategoryGridDict {
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: string; // template, contains literal "{count}"
  nextLevelBadgeLabel: string; // template, contains literal "{level}"
}

export default function CategoryGrid({
  dict,
  summary,
  levelFilter,
  onSelectCategory,
}: {
  dict: CategoryGridDict;
  summary: Record<string, CategorySummary>;
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
              onClick={() => onSelectCategory(category)}
              className="relative flex flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 dark:border-white/10"
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
              <span className="text-xs text-foreground/50">{dict.cardCountLabel.replace("{count}", String(total))}</span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
