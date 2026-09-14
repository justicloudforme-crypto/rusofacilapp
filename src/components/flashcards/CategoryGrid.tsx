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
import { useIsNativeShell } from "@/lib/native-shell-client";
import { ACCESS_MARK_ICON, flashcardRequirement } from "@/lib/access-marks";
import { nativeAccessCopy } from "@/lib/native-access-copy";
import { NativeLockedNotice } from "./FreeTrialLimitBanner";

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
  bank = {},
  lockedAtLevel = 0,
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
  /**
   * ПЛИТКА НЕ ИМЕЕТ ПРАВА ПИСАТЬ «0 СЛОВ», КОГДА СЛОВА ЕСТЬ — 7.195, часть 3.
   *
   * `summary` выше считает ДОСТУПНОЕ. На уровне C1 у неоплатившего это ноль
   * по каждой из 23 тем, и все 23 плитки писали «0 слов» — при 988 строках
   * C1 в боевой базе. Ноль означал «ноль доступных», а человек читает
   * «ничего нет»: тот же класс промаха, что «Нет карточек для этого
   * фильтра» в долге 191.
   *
   * Здесь — перепись БАНКА тем же разрезом (`bankCategories` в ответе
   * `/api/flashcards/summary`): сколько строк есть и сколько из них
   * закрыто. Читается ТОЛЬКО внутри оболочки: в вебе плитка остаётся
   * ровно такой, какой была, и это проверяется отдельно.
   */
  bank?: Record<string, { bank: number; open: number; locked: number }>;
  /** Сколько закрыто на ВЫБРАННОМ уровне по всему банку. Печатается одной
   *  плашкой над сеткой внутри оболочки; 0 — плашки нет. */
  lockedAtLevel?: number;
  onSelectCategory: (category: FlashcardCategory) => void;
}) {
  const nativeShell = useIsNativeShell();
  // Сорт материала у выбранного уровня: C1 — план Premium (👑), остальное —
  // подписка (🔒). Решает признак, а не эта разметка.
  const levelRequirement =
    levelFilter && levelFilter !== "all" ? flashcardRequirement({ level: levelFilter }) : "subscription";
  const mark = levelRequirement === "premium-tier" ? "premium-tier" : "subscription";
  const markLabel =
    mark === "premium-tier" ? nativeAccessCopy(dict.locale).locked.badgePremium : nativeAccessCopy(dict.locale).locked.badge;

  return (
    <div>
      {nativeShell && lockedAtLevel > 0 && (
        <NativeLockedNotice
          locale={dict.locale}
          lockedTotal={lockedAtLevel}
          level={levelFilter && levelFilter !== "all" ? levelFilter : null}
          unit="words"
          requirement={levelRequirement}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {flashcardCategories.map((category) => {
          const stat = summary[category];
          const openHere = stat?.total ?? 0;
          const bankHere = bank[category]?.bank ?? 0;
          // Внутри оболочки плитка называет то, что ЕСТЬ; в вебе — то, что
          // доступно, ровно как было. Запасное значение — доступное: если
          // перепись банка почему-то не пришла, плитка не станет врать в
          // другую сторону.
          const total = nativeShell && bankHere > 0 ? bankHere : openHere;
          // Открытое берётся у ТОЙ ЖЕ переписи, что и банк: `summary`
          // считается другим проходом, и на стыке двух источников знак
          // разошёлся бы с числом.
          const openHereInBank = bank[category]?.open ?? openHere;
          const allLocked = nativeShell && bankHere > 0 && openHereInBank === 0;
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
              data-testid="category-tile"
              data-total={total}
              data-bank-total={bankHere}
              onClick={() => {
                hapticTap();
                onSelectCategory(category);
              }}
              // `h-full` and the `mt-auto` on the bar below: see
              // ContinueStrip. A grid item already stretches to its row, but
              // the button's own column did not, so the bar sat under
              // whatever the label happened to be and two tiles in one row
              // had their bars 19px apart on /es at 1024.
              className="tap relative flex h-full flex-col items-start gap-2 rounded-2xl border border-black/10 bg-background p-4 text-left transition-colors hover:border-foreground/40 active:border-foreground/40 dark:border-white/30"
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
              {/* Two lines' worth of room (44px: 14px text at leading-snug
                  wraps to 38.5px, and the box is never smaller than that)
                  whether the label needs it or not, so a one-word category
                  and a four-word one are the same height — the same
                  reservation ContinueStrip makes. A MINIMUM, not a clamp: a
                  label that genuinely needs three lines still gets them
                  rather than being cut, and `h-full` keeps its row square. */}
              <span className="min-h-11 text-sm font-medium leading-snug">{dict.categoryLabels[category]}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/50">
                {plural(dict.locale, total, dict.cardCountLabel, { count: total })}
                {/* Метка, а не орган управления: `data-access-mark` — то,
                    по чему сторож отрисованных поверхностей отличает знак
                    сорта от подписи кнопки покупки (7.195, часть 4). */}
                {allLocked && (
                  <span
                    data-access-mark={mark}
                    title={markLabel}
                    className="inline-flex items-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-[0.7rem] text-foreground/70"
                  >
                    <span aria-hidden>{ACCESS_MARK_ICON[mark]}</span>
                  </span>
                )}
              </span>
              {hasAnyProgress && (
                <ProgressBar percent={percent} tone="success" className="mt-auto w-full pt-1" ariaLabel={dict.categoryLabels[category]} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
