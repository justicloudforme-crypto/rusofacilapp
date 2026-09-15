"use client";

import { flashcardLevels, type FlashcardLevel } from "@/lib/flashcards";
import { ACCESS_MARK_ICON, levelRequirement, sortSign } from "@/lib/access-marks";

export interface LevelFilterDict {
  levelAll: string;
  /** Подпись значка «нужен план Premium» — одна на весь сайт
   * (`dict.access.premiumTierBadge`). */
  premiumTierBadge: string;
}

/** The ВСЕ/A1/A2/B1 pill row shared by every vocabulary study mode.
 * `disabled` locks the whole row — used by the round-based modes (recall,
 * fill-blank, match) while a round is in progress, so the level a round
 * was built against can't silently change out from under it. Previously
 * each mode reimplemented this row separately, and only one of them
 * (match) got a working lock; the other two let you click a level button
 * mid-round that visibly did nothing, which read as "randomization is
 * broken" as much as "the button is broken". FlashcardsApp's free-browse
 * mode has no round to lock, so it always passes disabled={false}. */
export default function LevelFilterBar({
  dict,
  value,
  onChange,
  disabled = false,
}: {
  dict: LevelFilterDict;
  value: FlashcardLevel | "all";
  onChange: (level: FlashcardLevel | "all") => void;
  disabled?: boolean;
}) {
  return (
    <div data-testid="level-filter" className="flex flex-wrap gap-2">
      <button
        type="button"
        data-level="all"
        onClick={() => onChange("all")}
        disabled={disabled}
        className={`tap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          value === "all"
            ? "bg-foreground text-background"
            : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
        }`}
      >
        {dict.levelAll}
      </button>
      {flashcardLevels.map((lvl) => (
        <button
          key={lvl}
          type="button"
          data-level={lvl}
          onClick={() => onChange(lvl)}
          disabled={disabled}
          className={`tap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === lvl
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {lvl}
          {/*
            КОРОНА — МЕТКА СОРТА, А НЕ СОСТОЯНИЯ ДОСТУПА (7.195, часть 4).

            До правки корона стояла только у того, кто уровень открыть НЕ
            может (`premiumLockedLevel` приходил как `premiumOnlyWords > 0
            ? "C1" : null`), то есть подписчику плана Premium граница
            платного не показывалась вовсе. Решение владельца 14.09.2026:
            весь премиальный материал помечен одинаково, независимо от
            роли, — человек должен видеть, где проходит граница и что
            именно даёт подписка.

            Какой уровень премиальный, решает признак
            (`flashcardRequirement`), а не список здесь: то же правило
            читают карточка, плашка закрытого и поиск.

            `data-access-mark` — по нему сторож отрисованных поверхностей
            отличает МЕТКУ от подписи органа управления: корона ничего не
            предлагает купить и никуда не ведёт.
          */}
          {/* 7.196: знак приходит от ОБЩЕГО правила
              (`sortSign` — та же строка, с которой начинается
              `accessSignFor`), а не выбирается здесь сравнением с
              «premium-tier». Поведение то же, знак в знак; разница в том,
              что правило теперь одно на все одиннадцать поверхностей. */}
          {(() => {
            const sign = sortSign(levelRequirement("flashcards", lvl));
            if (!sign) return null;
            return (
              <span data-access-mark={sign.mark} aria-hidden className="ml-1" title={dict.premiumTierBadge}>
                {ACCESS_MARK_ICON[sign.mark]}
              </span>
            );
          })()}
        </button>
      ))}
    </div>
  );
}
