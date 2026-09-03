"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicPuzzle } from "@/lib/word-games/data";
import type { Locale } from "@/i18n/config";
import CrosswordBoard from "./CrosswordBoard";
import WordSearchBoard from "./WordSearchBoard";
import GameResultPanel, { type GameResultPanelDict } from "@/components/games/GameResultPanel";
import { fetchCategorySummary } from "@/lib/flashcards/summary-client";
import { postReliably } from "@/lib/reliable-post";
import { learnedProgressText, type LearnedProgressDict } from "@/lib/flashcards/learned-progress";

export interface WordGamePlayerDict {
  hintButton: string;
  hintUsedNote: string;
  wordsFoundLabel: string;
  cluesTitle: string;
  acrossLabel: string;
  downLabel: string;
  signInToSaveNote: string;
  solvedTitle: string;
  solvedSubtitle: string;
  playAgainButton: string;
  wrongCellHint: string;
  resetSelectionButton: string;
  expertModeLabel: string;
  backToWordGames: string;
  breakdownButton: string;
  hideBreakdownButton: string;
  breakdownLabel: string; // {across} {acrossTotal} {down} {downTotal}
  progressCountLabel: string; // {solved} {words} {filled} {cells}
  wordSearchGridLabel: string;
  crosswordGridLabel: string;
  /** Строка «выучено N из M» под панелью результата. Те же два ключа, что
   * у режимов словаря: предложение одно и то же, и второй копии текста в
   * словаре быть не должно. Какая из двух форм печатается, решает
   * learned-progress.ts по числу закрытых слов, а не по тарифу. */
  learnedProgressLabel: LearnedProgressDict["learnedProgressLabel"];
  learnedProgressAvailableLabel: LearnedProgressDict["learnedProgressAvailableLabel"];
}

/** Orchestrates one puzzle attempt: picks the right board (crossword vs
 * word search), tracks elapsed time + whether a hint was used this
 * attempt, and reports completion once the board reports solved. Boards
 * hold their own cell-level state; this component only cares about the
 * attempt-level outcome. */
export default function WordGamePlayer({
  lang,
  puzzle,
  dict,
  resultDict,
  signedIn,
}: {
  lang: Locale;
  puzzle: PublicPuzzle;
  dict: WordGamePlayerDict;
  resultDict: GameResultPanelDict;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [usedHint, setUsedHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [roundTimeSeconds, setRoundTimeSeconds] = useState(0);
  // Bumped on "play again" and used as CrosswordBoard/WordSearchBoard's
  // key — forces a full remount so guesses/found-words/timer/hint-used
  // all reset cleanly for a fresh attempt at the same puzzle, instead of
  // trying to hand-reset each board's internal state piece by piece.
  const [attempt, setAttempt] = useState(0);
  // Only crossword reports this (word search has no "wrong attempt"
  // concept) — undefined keeps GameResultPanel's error row hidden there.
  // Starts at 0 (not undefined) for crossword so a perfect solve — zero
  // wrong letters, onErrorCountChange never fires — still shows "0", not
  // an incorrectly hidden stat.
  const [errorCount, setErrorCount] = useState<number | undefined>(puzzle.type === "CROSSWORD" ? 0 : undefined);
  // `total` — сколько слов доступно ЭТОМУ игроку, `locked` — сколько
  // добавит Premium. Оба числа приходят с сервера и здесь не считаются
  // (PROGRESS 7.76: знаменатель «из 5683» для не-Premium был неправдой).
  const [totalProgress, setTotalProgress] = useState({ known: 0, total: 0, locked: 0 });
  const completeReported = useRef(false);

  // Запрос уходит только после решения: до него панели нет, а лишний
  // POST на каждом открытии пазла — это запрос ради строки, которую никто
  // не видит.
  useEffect(() => {
    if (!solved) return;
    let alive = true;
    fetchCategorySummary("all").then((body) => {
      if (!alive) return;
      setTotalProgress({ known: body.totalKnown, total: body.availableWords, locked: body.premiumOnlyWords });
    });
    return () => {
      alive = false;
    };
  }, [solved]);

  const handleHintUsed = useCallback(() => setUsedHint(true), []);

  const handleSolved = useCallback(() => {
    setSolved(true);
    setRoundTimeSeconds(Math.round((Date.now() - startedAt) / 1000));
    if (completeReported.current) return;
    completeReported.current = true;
    const timeSeconds = Math.round((Date.now() - startedAt) / 1000);
    // Это ЗАПИСЬ, а не чтение: сюда уезжает единственное свидетельство
    // того, что пазл решён (WordGameProgress — галочка на лестнице и
    // отметка дня занятия). Раньше стояло `fetch(...).catch(() => {})` —
    // один обрыв сети, и запись терялась молча, а как раз в этот момент
    // ученик и уходит со страницы кнопкой «к играм». postReliably даёт
    // keepalive (запрос доживает после выгрузки документа), повтор с
    // паузой и маячок последним рубежом — src/lib/reliable-post.ts.
    void postReliably("/api/word-games/complete", {
      puzzleId: puzzle.id,
      timeSeconds,
      usedHint,
    }).then((outcome) => {
      if (outcome === "ok") return;
      // Ни fetch, ни маячок не прошли. Молчать здесь нельзя: это
      // потерянная запись, а не шум, — но и падать некуда, пазл уже решён.
      console.warn(`[word-games] Результат пазла ${puzzle.id} не записан (${outcome}).`);
    });
  }, [puzzle.id, usedHint, startedAt]);

  function playAgain() {
    setAttempt((a) => a + 1);
    setUsedHint(false);
    setSolved(false);
    setStartedAt(Date.now());
    setErrorCount(puzzle.type === "CROSSWORD" ? 0 : undefined);
    completeReported.current = false;
  }

  function backToList() {
    router.push(`/${lang}/word-games`);
  }

  return (
    <div className="flex flex-col gap-6">
      {!signedIn && (
        <p className="rounded-xl border border-dashed border-black/10 p-3 text-sm text-foreground/60 dark:border-white/15">
          {dict.signInToSaveNote}
        </p>
      )}

      {usedHint && !solved && (
        <p className="text-xs font-medium text-foreground/50">{dict.hintUsedNote}</p>
      )}

      {puzzle.type === "CROSSWORD" ? (
        <CrosswordBoard
          key={attempt}
          puzzle={puzzle}
          dict={dict}
          onHintUsed={handleHintUsed}
          onSolved={handleSolved}
          onErrorCountChange={setErrorCount}
        />
      ) : (
        <WordSearchBoard key={attempt} puzzle={puzzle} dict={dict} onSolved={handleSolved} />
      )}

      <GameResultPanel
        open={solved}
        onClose={backToList}
        title={dict.solvedTitle}
        avatarId="matryoshka_proud"
        timeSeconds={roundTimeSeconds}
        errors={errorCount}
        dict={resultDict}
        playAgainLabel={dict.playAgainButton}
        onPlayAgain={playAgain}
        nextGameLabel={dict.backToWordGames}
        onNextGame={backToList}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Найдено слов N из M. Решённый пазл — это всегда «все», и
              именно поэтому число печатается: игрок видит, сколько слов
              он только что нашёл, а не только время. */}
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {dict.wordsFoundLabel
              .replace("{found}", String(puzzle.words.length))
              .replace("{total}", String(puzzle.words.length))}
          </span>
          {totalProgress.total > 0 && (
            <p className="text-center text-sm text-foreground/60">
              {learnedProgressText(resultDict.locale, dict, {
                known: totalProgress.known,
                available: totalProgress.total,
                locked: totalProgress.locked,
              })}
            </p>
          )}
          {usedHint && <p className="text-xs font-medium text-foreground/50">{dict.hintUsedNote}</p>}
        </div>
      </GameResultPanel>
    </div>
  );
}
