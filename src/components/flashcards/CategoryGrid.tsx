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
import { ACCESS_MARK_ICON, accessSignFor, levelRequirement, trialSet, type ViewerTier } from "@/lib/access-marks";
import { NativeLockedNotice } from "./FreeTrialLimitBanner";

export type { CategorySummary } from "@/lib/flashcards/summary-client";

export interface CategoryGridDict {
  /** Подписи знаков — из словаря сайта, одни на весь сайт
   *  (`dict.access.*`, приезжают спредом на странице). Собирать текст
   *  здесь нельзя: он локаль-зависим. */
  premiumTierBadge: string;
  subscriptionBadge: string;
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
  summaryLevel,
  tier = "free",
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
   * закрыто.
   *
   * ЧИТАЕТСЯ ВЕЗДЕ — ДОЛГ 257, решение владельца 18.09.2026. До этой
   * правки перепись читала ТОЛЬКО ветка `useIsNativeShell()`, и это было
   * действующим правилом, а не промахом: в вебе плитка оставалась такой,
   * какой была. Замер 18.09.2026 на прод-сборке (три роли × две локали ×
   * оболочка/веб = 12 экранов, ширина 384) назвал цену этого правила
   * числом: внутри оболочки на C1 стоят 23 короны, 23 замка и сумма чисел
   * на плитках 988; в браузере у бесплатного и у доступа по коду — 0
   * корон, 0 замков и сумма 0 при тех же 988 строках банка. Один и тот же
   * раздел выглядел пустым в браузере и полным в приложении.
   *
   * Решение владельца: в браузере то же самое, что в приложении. Ветки
   * оболочки здесь больше нет ни одной — и за этим следит
   * `check:zero-placeholder`.
   */
  bank?: Record<string, { bank: number; open: number; locked: number }>;
  /** Сколько закрыто на ВЫБРАННОМ уровне по всему банку. Печатается одной
   *  плашкой над сеткой внутри оболочки; 0 — плашки нет. */
  lockedAtLevel?: number;
  /**
   * РАЗРЕЗ, ПО КОТОРОМУ ПОСЧИТАНЫ ЧИСЛА В РУКАХ — 7.196, часть 2.
   *
   * `undefined` — ответа ещё нет; `null` — ответ про все уровни; строка —
   * про этот уровень. Пока он не совпадает с `levelFilter`, числа на
   * плитке ЧУЖИЕ, и печатать их нельзя: замер 14.09.2026 с задержкой
   * ответа 3000 мс показал «266 слов» и отсутствие знака всё время
   * ожидания на уровне C1, где в банке 8 премиальных строк.
   */
  summaryLevel?: string | null;
  /** Тариф спрашивающего — приходит тем же ответом; нужен общему правилу знака. */
  tier?: ViewerTier;
  onSelectCategory: (category: FlashcardCategory) => void;
}) {
  // Сорт материала у выбранного уровня: C1 — план Premium (👑), остальное —
  // подписка (🔒). Решает признак, а не эта разметка.
  const requirement =
    levelFilter && levelFilter !== "all" ? levelRequirement("flashcards", levelFilter) : "subscription";

  /**
   * ЧИСЛА В РУКАХ — СВОИ ИЛИ ЧУЖИЕ (7.196, часть 2).
   *
   * Одно условие закрывает оба дефекта владельца сразу: «плитки печатают
   * 0 слов, пока данные едут» и «на уровне C1 плитка пишет 266 слов».
   * Оба — одно и то же положение дел: на экране нарисованы числа, которые
   * к текущему разрезу не относятся. Пока ответ не про этот уровень,
   * плитка не печатает ЧИСЛО вовсе — на его месте серая полоса.
   *
   * ПРАВИЛО РАСПРОСТРАНЕНО НА ВЕБ — 7.204, долг 224.
   *
   * До 17.09.2026 здесь стояло `!nativeShell || …`, то есть в браузере
   * заглушки не было вовсе и плитка печатала «0 palabras» всё время,
   * пока едет ответ. Замер 16.09.2026 на проде: серверная отдача
   * `/es/vocabulary` — 23 плитки с `data-bank-total="0"`, заглушек 0,
   * TTFB 1,30 с. «Данных ещё нет» и «данных ноль» выглядели одинаково.
   *
   * Настоящий ноль (ответ пришёл, и в нём ноль) печатается числом, как и
   * печатался: условие смотрит на РАЗРЕЗ ответа, а не на величину.
   */
  const ready = summaryLevel !== undefined && (summaryLevel ?? "all") === levelFilter;

  return (
    <div>
      {ready && lockedAtLevel > 0 && (
        <NativeLockedNotice
          locale={dict.locale}
          lockedTotal={lockedAtLevel}
          level={levelFilter && levelFilter !== "all" ? levelFilter : null}
          unit="words"
          requirement={requirement}
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {flashcardCategories.map((category) => {
          const stat = summary[category];
          const openHere = stat?.total ?? 0;
          const bankHere = bank[category]?.bank ?? 0;
          // Плитка называет то, что ЕСТЬ, — и в приложении, и в браузере
          // (долг 257). Запасное значение — доступное: если перепись банка
          // почему-то не пришла, плитка не станет врать в другую сторону.
          const total = bankHere > 0 ? bankHere : openHere;
          // Открытое берётся у ТОЙ ЖЕ переписи, что и банк: `summary`
          // считается другим проходом, и на стыке двух источников знак
          // разошёлся бы с числом.
          const openHereInBank = bank[category]?.open ?? openHere;
          // ФАКТ, А НЕ ВЕРДИКТ — 7.212. Здесь считается только то, что
          // знает плитка: приехала ли перепись банка и сколько карточек
          // темы отдано бесплатной пробе. Закрыта тема или нет, решает
          // общее правило (`isClosedFor` в `access-marks.ts`), и решает
          // одно на весь продукт.
          /**
           * ЗНАК РЕШАЕТ ОБЩЕЕ ПРАВИЛО — 7.196, часть 1.
           *
           * До правки плитка ставила знак только там, где нельзя открыть
           * НИЧЕГО, и знак этот выбирался здесь же выражением «C1 —
           * корона, иначе замок». Два следствия были видны на экране: у
           * подписчика Premium короны на C1 не было вовсе (открыто —
           * значит молчим), а закрытость и сорт решались двумя разными
           * строками в двух разных файлах.
           *
           * Теперь и то и другое решает `accessSignFor`: корона — сорт
           * (стоит при любом тарифе), замок — состояние доступа, и
           * закрытость плитка называет сама, потому что про бесплатную
           * пробу знает больше, чем правило.
           */
          /**
           * `nativeShell: true` — ИМЯ ОПЦИИ, А НЕ МЕСТО (долг 257).
           *
           * Опция включает правило «корона это сорт, замок это состояние»
           * (см. шапку `access-marks.ts`). Имя ей досталось от места, где
           * правило появилось впервые, — от оболочки. С 18.09.2026 сетка
           * тем словаря просит его и в браузере: решение владельца
           * «в вебе то же самое, что в приложении». Прежнее правило
           * (`accessMarkFor`) осталось за остальными поверхностями.
           */
          const sign = accessSignFor(requirement, tier, {
            nativeShell: true,
            openness: trialSet(bankHere > 0, openHereInBank),
          });
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
                {/* ЗАГЛУШКА ВМЕСТО НУЛЯ (7.196 часть 2б; на веб
                    распространено в 7.204, долг 224). Пока числа чужие
                    или их нет вовсе, на месте числа серая полоса: «0
                    слов» человек читает как «ничего нет», и до правки
                    это печаталось на 23 плитках из 23 всё время, пока
                    едет ответ. */}
                {ready ? (
                  plural(dict.locale, total, dict.cardCountLabel, { count: total })
                ) : (
                  <span
                    data-testid="tile-count-skeleton"
                    aria-hidden
                    className="inline-block h-3 w-14 animate-pulse rounded bg-foreground/15 align-middle"
                  />
                )}
                {/* Метка, а не орган управления: `data-access-mark` — то,
                    по чему сторож отрисованных поверхностей отличает знак
                    сорта от подписи кнопки покупки (7.195, часть 4). */}
                {sign && (
                  <span
                    data-access-mark={sign.mark}
                    title={sign.labelKey === "premiumTierBadge" ? dict.premiumTierBadge : dict.subscriptionBadge}
                    className="inline-flex items-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-[0.7rem] text-foreground/70"
                  >
                    <span aria-hidden>{ACCESS_MARK_ICON[sign.mark]}</span>
                  </span>
                )}
                {/* ЗАМОК РЯДОМ С КОРОНОЙ — долг 251, решение владельца
                    18.09.2026. Тот же знак и то же правило, что на плитке
                    пазла: корона — сорт, замок — состояние. У Premium на
                    C1 замка нет, потому что тема ему открыта. Признака
                    `data-access-mark` узел не носит: знаков платного на
                    плитке по-прежнему один. */}
                {sign?.locked && (
                  <span
                    data-access-locked="true"
                    title={dict.subscriptionBadge}
                    className="inline-flex items-center rounded-full bg-foreground/10 px-1.5 py-0.5 text-[0.7rem] text-foreground/70"
                  >
                    <span aria-hidden>{ACCESS_MARK_ICON.subscription}</span>
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
