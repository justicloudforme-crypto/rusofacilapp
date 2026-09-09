"use client";

import { flashcardLevels, type FlashcardLevel } from "@/lib/flashcards";
import { ACCESS_MARK_ICON } from "@/lib/access-marks";

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
  premiumLockedLevel = null,
}: {
  dict: LevelFilterDict;
  value: FlashcardLevel | "all";
  onChange: (level: FlashcardLevel | "all") => void;
  disabled?: boolean;
  /**
   * Уровень, который этому посетителю НЕ откроется без плана Premium.
   *
   * До 09.09.2026 значка здесь не было вовсе: кнопка C1 стояла в ряду
   * наравне с A1–B2, а за ней у неоплатившего лежала пустая сетка — 988
   * карточек из 5771 отдаются только плану Premium, и страница об этом
   * молчала. «Платность есть — знака нет», ровно тот класс.
   *
   * Признак приходит от вызывающего, а не собирается здесь: кто именно
   * закрыт, знает только ответ `/api/flashcards/summary`
   * (`premiumOnlyWords` — разность целого банка и доступного этому
   * тарифу), то есть тот же гейт, который режет выдачу.
   */
  premiumLockedLevel?: FlashcardLevel | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
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
          onClick={() => onChange(lvl)}
          disabled={disabled}
          className={`tap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            value === lvl
              ? "bg-foreground text-background"
              : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
          }`}
        >
          {lvl}
          {premiumLockedLevel === lvl && (
            <span aria-hidden className="ml-1" title={dict.premiumTierBadge}>
              {ACCESS_MARK_ICON["premium-tier"]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
