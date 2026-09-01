"use client";

import type { ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import Confetti from "@/components/celebration/Confetti";
import type { AvatarId } from "@/lib/avatars";
import type { Locale } from "@/i18n/config";
import { plural, type PluralForms } from "@/lib/plural";

export interface GameResultPanelDict {
  closeLabel: string;
  /** The learner's locale, carried inside the dict rather than as a prop of
   * its own: every one of the six places that builds this object is a server
   * page that already has `lang` in hand, and the five wrappers in between
   * (RecallApp, MatchApp, FillBlankApp, WordGamePlayer, VocabularyApp) pass
   * the object straight through without unpacking it. */
  locale: Locale;
  /** Inflects with {total} — "1 de 1 correcta", "2 de 5 correctas". */
  resultScoreLabel: PluralForms; // templates, contain literal "{correct}" and "{total}"
  resultTimeLabel: string; // template, contains literal "{time}"
  /** Written as "noun: number", so it never has to agree with the count. */
  resultErrorsLabel: string; // template, contains literal "{count}"
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, "0")}` : `${seconds}s`;
}

/**
 * Shared result screen for every study mode/game (Recall, FillBlank,
 * Match, crossword, word search): score, time, errors, confetti, and two
 * next-step buttons. Built on the site's Modal (bottom sheet < 640px,
 * centered dialog above it) rather than a bespoke overlay, so it already
 * inherits safe-area padding and sits above BottomNav (Modal is z-50 vs
 * BottomNav's z-40) for free. `score`/`errors` are optional since not
 * every mode has both (crossword tracks errors, word search doesn't;
 * Recall/FillBlank/Match have a score, crossword/word search don't).
 * `children` is an open slot for mode-specific content below the stats —
 * e.g. Recall/FillBlank/Match's free-trial paywall banner + personalized
 * progress message.
 */
export default function GameResultPanel({
  open,
  onClose,
  title,
  avatarId,
  score,
  timeSeconds,
  errors,
  dict,
  playAgainLabel,
  onPlayAgain,
  nextGameLabel,
  onNextGame,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  avatarId?: AvatarId;
  score?: { correct: number; total: number };
  timeSeconds: number;
  errors?: number;
  dict: GameResultPanelDict;
  playAgainLabel: string;
  onPlayAgain: () => void;
  nextGameLabel: string;
  onNextGame: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} closeLabel={dict.closeLabel}>
      {open && <Confetti />}
      <div className="flex flex-col items-center gap-4 pb-2 pt-2 text-center">
        {avatarId && (
          <span className="celebration-panel">
            <MatryoshkaAvatar id={avatarId} size={88} />
          </span>
        )}
        <p className="text-lg font-semibold">{title}</p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {score && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {plural(dict.locale, score.total, dict.resultScoreLabel, {
                correct: score.correct,
                total: score.total,
              })}
            </span>
          )}
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-text">
            {dict.resultTimeLabel.replace("{time}", formatTime(timeSeconds))}
          </span>
          {errors !== undefined && (
            <span className="rounded-full bg-foreground/5 px-3 py-1 text-sm font-medium text-foreground/70">
              {dict.resultErrorsLabel.replace("{count}", String(errors))}
            </span>
          )}
        </div>

        {children && <div className="w-full">{children}</div>}

        <div className="mt-2 flex w-full gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="tap min-h-11 flex-1 rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/40 hover:text-foreground active:border-foreground/40 active:text-foreground dark:border-white/30"
          >
            {playAgainLabel}
          </button>
          <button
            type="button"
            onClick={onNextGame}
            className="tap min-h-11 flex-1 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
          >
            {nextGameLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
