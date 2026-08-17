"use client";

import { flashcardCategories, type FlashcardCategory } from "@/lib/flashcards";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";

export interface CategorySummary {
  total: number;
  known: number;
}

export interface CategoryGridDict {
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: string; // template, contains literal "{count}"
}

export default function CategoryGrid({
  dict,
  summary,
  onSelectCategory,
}: {
  dict: CategoryGridDict;
  summary: Record<string, CategorySummary>;
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

          return (
            <button
              key={category}
              type="button"
              onClick={() => onSelectCategory(category)}
              className="flex flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 dark:border-white/10"
            >
              <span className="text-3xl" aria-hidden>
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
