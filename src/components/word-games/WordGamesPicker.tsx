"use client";

import { useState } from "react";
import Link from "next/link";
import type { FlashcardLevel } from "@/lib/flashcards";
import { flashcardLevels } from "@/lib/flashcards";
import type { WordGameType } from "@/lib/word-games/types";
import type { Locale } from "@/i18n/config";
import { usePaywall } from "@/contexts/PaywallContext";
import TabBar from "@/components/ui/TabBar";
import FilterChipGroup from "@/components/ui/FilterChipGroup";
import { ACCESS_MARK_ICON, accessMarkFor, wordGameRequirement, type ViewerTier } from "@/lib/access-marks";

export type PickerData = Record<
  WordGameType,
  Record<FlashcardLevel, { total: number; completed: number[]; curved: number[]; premiumOnly: number[] }>
>;

export interface WordGamesPickerDict {
  typeWordSearch: string;
  typeCrossword: string;
  chooseLevelLabel: string;
  puzzleLabel: string;
  completedBadge: string;
  expertModeLabel: string;
  premiumTierLabel: string;
  subscriptionLabel: string;
}

/** Type tab + level pill + sequence grid — self-paced, matches the rest of
 * the app: every sequence tile stays a live link regardless of progress,
 * the checkmark is a status badge, never a lock (see the rusofasil
 * flashcard level-progress precedent this follows). */
export default function WordGamesPicker({
  lang,
  dict,
  data,
  isPremium,
  isSubscriber,
}: {
  lang: Locale;
  dict: WordGamesPickerDict;
  data: PickerData;
  /** Whether the current visitor has the Premium plan — ★ (curved)
   * puzzles are Premium-exclusive (see entitlement.ts canAccessCurvedPuzzle);
   * everyone else taps into the paywall instead of the puzzle page. */
  isPremium: boolean;
  /**
   * Есть ли у посетителя ЛЮБАЯ активная подписка.
   *
   * Отдельно от `isPremium`, потому что рунгов за десяткой — большинство,
   * и анониму они отвечают 307 в `/pricing`. До 07.09.2026 плитка такого
   * рунга выглядела как открытая: числом по боевой базе — 984 пазла из
   * 3277 требуют плана Premium, и корона стояла лишь у 505 из них
   * (у 479 `curved` вместо короны была одна звезда), а «нужна подписка»
   * не отмечалось вовсе ни у одного из 2210 остальных платных.
   */
  isSubscriber: boolean;
}) {
  const [type, setType] = useState<WordGameType>("WORD_SEARCH");
  const [level, setLevel] = useState<FlashcardLevel>("A1");
  const { openPaywall } = usePaywall();

  const { total, completed, curved, premiumOnly } = data[type][level];
  const completedSet = new Set(completed);
  const curvedSet = new Set(curved);
  const premiumOnlySet = new Set(premiumOnly);

  return (
    <div className="mt-8 flex flex-col gap-6">
      <TabBar
        items={[
          { id: "WORD_SEARCH" as const, label: dict.typeWordSearch },
          { id: "CROSSWORD" as const, label: dict.typeCrossword },
        ]}
        activeId={type}
        onSelect={setType}
      />

      <FilterChipGroup
        label={dict.chooseLevelLabel}
        options={flashcardLevels.map((lvl) => ({ id: lvl, label: lvl }))}
        activeId={level}
        onChange={setLevel}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: total }, (_, i) => i + 1).map((sequence) => {
          const isCompleted = completedSet.has(sequence);
          const isCurved = curvedSet.has(sequence);
          const isPremiumOnlySeq = premiumOnlySet.has(sequence);
          /**
           * Требование берётся у общего признака, а не собирается здесь
           * заново. Прежнее `isPremiumOnlySeq && !isPremium` совпадало с
           * воротами страницы пазла только по данным: те смотрят
           * `row.curved || row.premiumOnly`, и `curved` без `premiumOnly`
           * на проде сегодня 0 из 479 — одна запись генератора отменяет
           * это молча (см. free-tier.ts про isPubliclyOpenableWordGamePuzzle).
           */
          const requirement = wordGameRequirement({
            type,
            level,
            sequence,
            curved: isCurved,
            premiumOnly: isPremiumOnlySeq,
          });
          const tier: ViewerTier = isPremium ? "premium" : isSubscriber ? "standard" : "free";
          const mark = accessMarkFor(requirement, tier);
          const isLocked = mark !== null;
          return (
            <Link
              key={sequence}
              href={`/${lang}/word-games/${type}/${level}/${sequence}`}
              // What this tile DOES, in the DOM. A locked tile looks like
              // any other (the ★/👑 glyph marks "Premium content", not
              // "locked for you" — a Premium subscriber sees the same
              // glyph on a tile that opens), so from outside there was no
              // way to tell a tile that navigates from one that opens the
              // paywall. e2e/paywall-modal.spec.ts needs exactly that
              // distinction, and it must not be guessed from a sequence
              // number: the premium-only rungs sit at different numbers in
              // dev.db and in the CI fixture.
              data-locked={isLocked ? "true" : undefined}
              onClick={(e) => {
                if (!isLocked) return;
                e.preventDefault();
                openPaywall(mark === "premium-tier" ? "premium" : "free");
              }}
              className={`tap relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-lg font-semibold transition-colors hover:border-foreground/40 active:border-foreground/40 ${
                isPremiumOnlySeq ? "border-primary/40 bg-primary/5 dark:border-primary-400/40 dark:bg-primary-400/10" : "border-black/10 dark:border-white/30"
              }`}
            >
              {/* ★ — про СЛОЖНОСТЬ, значок платности — про доступ. Это две
                  независимые вещи, и до 07.09.2026 они делили одно место:
                  у `curved`-пазла звезда вытесняла корону, хотя он тоже
                  открывается только плану Premium. Теперь звезда слева,
                  значок платности справа от неё, и ни один не прячет
                  другой. */}
              {isCurved && (
                <span
                  aria-label={dict.expertModeLabel}
                  title={dict.expertModeLabel}
                  className="absolute left-1.5 top-1.5 text-sm leading-none text-primary-text dark:text-primary-400"
                >
                  ★
                </span>
              )}
              {mark && (
                <span
                  aria-label={mark === "premium-tier" ? dict.premiumTierLabel : dict.subscriptionLabel}
                  title={mark === "premium-tier" ? dict.premiumTierLabel : dict.subscriptionLabel}
                  className={`absolute top-1.5 text-sm leading-none ${isCurved ? "left-5" : "left-1.5"} ${
                    mark === "premium-tier" ? "text-premium-500 dark:text-premium-300" : "text-foreground/45"
                  }`}
                >
                  {ACCESS_MARK_ICON[mark]}
                </span>
              )}
              {sequence}
              {isCompleted && (
                <span
                  aria-label={dict.completedBadge}
                  title={dict.completedBadge}
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.414l2.793 2.792 6.793-6.793a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
