"use client";

import type { FlashcardCategory } from "@/lib/flashcards";
import type { RecentCategory } from "@/lib/flashcards/summary-client";
import { flashcardCategoryIcons } from "@/lib/flashcards/category-icons";
import { hapticTap } from "@/lib/haptics";
import ProgressBar from "@/components/ui/ProgressBar";
import type { Locale } from "@/i18n/config";
import type { PluralForms } from "@/lib/plural";

export interface ContinueStripDict {
  locale: Locale;
  continueTitle: string;
  categoryLabels: Record<FlashcardCategory, string>;
  cardCountLabel: PluralForms; // templates, contain literal "{count}"
  /** «Продолжить со слова «{word}»» — шаблон, содержит литерал "{word}". */
  continueWithWord: string;
}

/**
 * «Продолжить» — до трёх тем, в которых человек недавно занимался.
 *
 * ЧЕМ ЭТОТ БЛОК ОТЛИЧАЕТСЯ ОТ СЕТКИ КАТЕГОРИЙ ПОД НИМ, и почему это
 * пришлось менять. До 09.09.2026 отличий не было ни одного — и не по
 * недосмотру: прежний комментарий здесь прямо требовал, чтобы плитка
 * «Продолжить» и плитка каталога были «одним и тем же», вплоть до
 * совпадения высоты (139 px против 151) и лесенки колонок. По
 * скриншоту человека 06.09.2026 это и читалось: два одинаковых ряда
 * плиток с одной иконкой и одним заголовком, второй похож на дубль
 * первого.
 *
 * Теперь это не плитки, а СТРОКИ, и различие держится на четырёх
 * независимых признаках сразу, а не на одном оттенке:
 *
 *   1. форма — строка во всю ширину против квадратной плитки в сетке
 *      2/3/4 колонок; на телефоне тоже строка, без горизонтальной
 *      прокрутки, которая была здесь раньше;
 *   2. рамка — левая полоса цвета акцента (`border-l-4 border-primary`)
 *      и подложка `bg-primary/5`, каких у карточек каталога нет;
 *   3. содержимое — названо СЛОВО, на котором человек остановился;
 *      сетка категорий про слова не говорит ничего;
 *   4. стрелка «→» справа: это продолжение занятия, а не вход в раздел.
 *
 * И главное — нажатие. Оно открывает не начало темы, а ту самую
 * карточку (`item.lastCardId`, максимум `updatedAt` внутри темы, см.
 * /api/flashcards/summary). Если её нет — тема открывается с начала,
 * ровно как раньше.
 */
export default function ContinueStrip({
  dict,
  recent,
  onSelectCategory,
}: {
  dict: ContinueStripDict;
  recent: RecentCategory[];
  onSelectCategory: (category: FlashcardCategory, startCardId?: string | null) => void;
}) {
  if (recent.length === 0) return null;

  return (
    <div className="mb-8" data-testid="continue-strip">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground/50">{dict.continueTitle}</h2>
      <div className="flex flex-col gap-2">
        {recent.map((item) => {
          const percent = item.total === 0 ? 0 : Math.round((item.known / item.total) * 100);
          return (
            <button
              key={item.category}
              type="button"
              data-testid="continue-row"
              data-category={item.category}
              data-card={item.lastCardId ?? undefined}
              onClick={() => {
                hapticTap();
                onSelectCategory(item.category, item.lastCardId);
              }}
              // min-h-14 (56px), не 44: строка несёт две строки текста и
              // полосу прогресса, и 44 их не вмещают. Тап-таргет заведомо
              // больше минимума и на 320 px, и на 768.
              className="tap flex min-h-14 w-full items-center gap-3 rounded-2xl border border-l-4 border-black/10 border-l-primary bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10 active:bg-primary/10 dark:border-white/20 dark:border-l-primary-400 dark:bg-primary-400/10 dark:hover:bg-primary-400/15"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-lg" aria-hidden>
                {flashcardCategoryIcons[item.category]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.lastCardWord
                    ? dict.continueWithWord.replace("{word}", item.lastCardWord)
                    : dict.categoryLabels[item.category]}
                </span>
                <span className="mt-0.5 block truncate text-xs text-foreground/60">
                  {dict.categoryLabels[item.category]} · {item.known}/{item.total} · {percent}%
                </span>
                <ProgressBar
                  percent={percent}
                  tone="success"
                  className="mt-1.5 w-full"
                  ariaLabel={dict.categoryLabels[item.category]}
                />
              </span>
              <span aria-hidden className="shrink-0 text-lg text-primary-text dark:text-primary-400">
                →
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
