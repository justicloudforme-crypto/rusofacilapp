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
import {
  ACCESS_MARK_ICON,
  accessMarkFor,
  accessSignFor,
  wordGameLevelHasFreePuzzle,
  wordGameRequirement,
  type ViewerTier,
} from "@/lib/access-marks";
import { useIsNativeShell } from "@/lib/native-shell-client";

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
  /** Видимая легенда знака ★ над сеткой — долг 213. Печатается только на
   *  тех уровнях, где пазлы со звездой ЕСТЬ. */
  expertModeLegend: string;
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
  const nativeShell = useIsNativeShell();
  const tier: ViewerTier = isPremium ? "premium" : isSubscriber ? "standard" : "free";

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

      {/*
        ЗНАК НА ПОЛОСЕ УРОВНЕЙ ИГР — 7.196, часть 1, и здесь он НЕ КОРОНА.

        Владелец ждал короны на C1, как в словаре. Замер запрещает: ворота
        страницы пазла смотрят `row.curved || row.premiumOnly` и про
        уровень не знают ничего, поэтому из 482 пазлов уровня C1 план
        Premium требуют 138, а остальные **344 открывает обычная подписка
        `standard`**. Корона у них была бы ровно тем враньём, из-за
        которого в 7.137 сняли «⭐ Premium» с 225 рассказов.

        Правда про этот уровень другая, и она печатается: бесплатных
        рунгов на C1 нет ни одного (`isFreeWordGamePuzzle` отвергает C1 до
        всякого номера), то есть гостю уровень закрыт ЦЕЛИКОМ — это 🔒,
        состояние доступа. Подписчику замка нет: у него открыто.
      */}
      <FilterChipGroup
        testId="word-game-level-filter"
        label={dict.chooseLevelLabel}
        options={flashcardLevels.map((lvl) => {
          const sign = nativeShell
            ? accessSignFor("subscription", tier, {
                nativeShell,
                closed: tier === "free" && !wordGameLevelHasFreePuzzle(type, lvl),
              })
            : null;
          return {
            id: lvl,
            label: lvl,
            accessMark: sign?.mark,
            accessLabel: sign
              ? sign.labelKey === "premiumTierBadge"
                ? dict.premiumTierLabel
                : dict.subscriptionLabel
              : undefined,
          };
        })}
        activeId={level}
        onChange={setLevel}
      />

      {/*
        ЗВЕЗДА ОБЪЯСНЕНА ГЛАЗАМИ, А НЕ ТОЛЬКО ПОДСКАЗКОЙ — долг 213,
        решение владельца от 15.09.2026: знак ОСТАВИТЬ, но человек обязан
        понимать, что он значит.

        До этой правки подпись у ★ жила только в `aria-label`/`title`
        (`wordGames.expertModeLabel`), то есть её нельзя было увидеть
        вовсе: на телефоне ни наведения, ни всплывающей подсказки нет.

        ЧТО ИМЕННО МЕНЯЕТ ПРИЗНАК `curved`, ПРОЧИТАНО В КОДЕ, А НЕ
        ПЕРЕСКАЗАНО. Две вещи, и обе про раскладку слов:
          — слово кладётся не лучом, а НЕПОВТОРЯЮЩЕЙСЯ ЦЕПОЧКОЙ соседних
            клеток (`src/lib/word-games/snake-word-search.ts`), то есть
            может гнуться в любой из восьми сторон на каждом шаге;
          — и выбор игрока разбирается тем же правилом: доска берёт
            `extendPath` вместо `extendPathStraight`
            (`src/components/word-games/WordSearchBoard.tsx:151`), то есть
            след не залипает на первой же прямой.
        Поэтому текст легенды говорит ровно это: слова гнутся, и след
        ведётся клетка за клеткой.

        ЗВЕЗДА И КОРОНА — РАЗНОЕ, И В ТЕКСТЕ ОНИ НЕ СМЕШИВАЮТСЯ (7.196):
        👑 — сорт материала, ★ — сложность задачи. Легенда ниже про
        сложность и про деньги не говорит ни слова.

        Условие — по данным этого разреза, а не по уровню: «на C1 звёзды
        есть» было бы догадкой, а `curved.length` — фактом про то, что
        нарисовано на экране прямо сейчас.
      */}
      {curved.length > 0 && (
        <p
          data-testid="expert-mode-legend"
          className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground/75 dark:border-primary-400/30 dark:bg-primary-400/10"
        >
          {dict.expertModeLegend}
        </p>
      )}

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
          // 7.196: ЗНАК и ЗАПЕРТОСТЬ — разные вопросы, и до правки на них
          // отвечала одна строка. Корона — сорт: она стоит у `curved` и
          // `premiumOnly` при ЛЮБОМ тарифе, включая Premium, у которого
          // плитка открывается. Заперта плитка или нет, решает прежний
          // `accessMarkFor` — то есть поведение нажатия не меняется ни на
          // одной плитке.
          const sign = accessSignFor(requirement, tier, { nativeShell });
          const isLocked = accessMarkFor(requirement, tier) !== null;
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
                openPaywall(requirement === "premium-tier" ? "premium" : "free", "puzzle");
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
              {sign && (
                <span
                  data-access-mark={sign.mark}
                  aria-label={sign.labelKey === "premiumTierBadge" ? dict.premiumTierLabel : dict.subscriptionLabel}
                  title={sign.labelKey === "premiumTierBadge" ? dict.premiumTierLabel : dict.subscriptionLabel}
                  className={`absolute top-1.5 text-sm leading-none ${isCurved ? "left-5" : "left-1.5"} ${
                    sign.mark === "premium-tier" ? "text-premium-500 dark:text-premium-300" : "text-foreground/45"
                  }`}
                >
                  {ACCESS_MARK_ICON[sign.mark]}
                </span>
              )}
              {/* ЗАМОК РЯДОМ С КОРОНОЙ — долг 251, решение владельца
                  18.09.2026. Корона называет СОРТ («это премиум») и стоит
                  у всех, включая Premium, которому плитка открывается;
                  замок называет СОСТОЯНИЕ («вам не открыто») и стоит
                  только у того, кому не открыто. До этой правки второго
                  знака не было вовсе, и аккаунт с доступом по коду видел
                  на 580 пазлах из 2015 корону и ничего больше.

                  Признак `data-access-mark` этот узел НЕ носит намеренно:
                  знак платного на плитке один и он выше, а по этому
                  признаку сторожа считают ЗНАКИ. Здесь состояние, и у
                  него свой признак. */}
              {sign?.locked && (
                <span
                  data-access-locked="true"
                  aria-label={dict.subscriptionLabel}
                  title={dict.subscriptionLabel}
                  className={`absolute top-1.5 text-sm leading-none text-foreground/45 ${
                    isCurved ? "left-[2.125rem]" : "left-5"
                  }`}
                >
                  {ACCESS_MARK_ICON.subscription}
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
