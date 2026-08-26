"use client";

import { useState } from "react";
import Link from "next/link";
import type { FlashcardLevel } from "@/lib/flashcards";
import { flashcardLevels } from "@/lib/flashcards";
import type { WordGameType } from "@/lib/word-games/types";
import type { Locale } from "@/i18n/config";
import { usePaywall } from "@/contexts/PaywallContext";

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
}: {
  lang: Locale;
  dict: WordGamesPickerDict;
  data: PickerData;
  /** Whether the current visitor has the Premium plan — ★ (curved)
   * puzzles are Premium-exclusive (see entitlement.ts canAccessCurvedPuzzle);
   * everyone else taps into the paywall instead of the puzzle page. */
  isPremium: boolean;
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
      <div className="flex gap-2" role="tablist">
        {(
          [
            ["WORD_SEARCH", dict.typeWordSearch],
            ["CROSSWORD", dict.typeCrossword],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => setType(t)}
            className={`tap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              type === t
                ? "bg-foreground text-background"
                : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
          {dict.chooseLevelLabel}
        </span>
        <div className="flex flex-wrap gap-2">
          {flashcardLevels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setLevel(lvl)}
              className={`tap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                level === lvl
                  ? "bg-foreground text-background"
                  : "border border-black/10 text-foreground/60 hover:text-foreground active:text-foreground dark:border-white/15"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {Array.from({ length: total }, (_, i) => i + 1).map((sequence) => {
          const isCompleted = completedSet.has(sequence);
          const isCurved = curvedSet.has(sequence);
          const isPremiumOnlySeq = premiumOnlySet.has(sequence);
          const isLocked = isPremiumOnlySeq && !isPremium;
          return (
            <Link
              key={sequence}
              href={`/${lang}/word-games/${type}/${level}/${sequence}`}
              onClick={(e) => {
                if (!isLocked) return;
                e.preventDefault();
                openPaywall("premium");
              }}
              className={`tap relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border text-lg font-semibold transition-colors hover:border-foreground/40 active:border-foreground/40 ${
                isPremiumOnlySeq ? "border-primary/40 bg-primary/5 dark:border-primary-400/40 dark:bg-primary-400/10" : "border-black/10 dark:border-white/10"
              }`}
            >
              {isCurved ? (
                <span
                  aria-label={dict.expertModeLabel}
                  title={dict.expertModeLabel}
                  className="absolute left-1.5 top-1.5 text-sm leading-none text-primary dark:text-primary-400"
                >
                  ★
                </span>
              ) : isPremiumOnlySeq ? (
                <span
                  aria-label={dict.premiumTierLabel}
                  title={dict.premiumTierLabel}
                  className="absolute left-1.5 top-1.5 text-sm leading-none text-premium-500 dark:text-premium-300"
                >
                  👑
                </span>
              ) : null}
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
