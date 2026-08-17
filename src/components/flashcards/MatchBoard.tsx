"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FlashcardRow } from "@/lib/flashcards";
import { shuffle } from "@/lib/flashcards/shuffle";

// How long the green/red flash holds before tiles unlock again — long
// enough to actually see the feedback, short enough not to feel like a
// forced pause between pairs.
const CORRECT_FLASH_MS = 450;
const WRONG_FLASH_MS = 650;

export interface MatchResult {
  cardId: string;
  firstTryCorrect: boolean;
}

type Side = "emoji" | "word";

function tileClass(state: "idle" | "selected" | "correct" | "wrong"): string {
  if (state === "correct") return "border-emerald-500 bg-emerald-500/10";
  if (state === "wrong") return "border-rose-500 bg-rose-500/10";
  if (state === "selected") return "border-foreground bg-foreground/5";
  return "border-black/10 dark:border-white/15 hover:border-foreground/40";
}

export default function MatchBoard({
  cards,
  onComplete,
}: {
  cards: FlashcardRow[];
  onComplete: (results: MatchResult[]) => void;
}) {
  // Shuffled once per round (this component remounts on a new round via
  // RecallApp-style key={roundKey}), independently for each side — that
  // independence is what makes the puzzle a puzzle instead of two
  // parallel, trivially-aligned lists.
  const emojiTiles = useMemo(() => shuffle(cards), [cards]);
  const wordTiles = useMemo(() => shuffle(cards), [cards]);

  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ emojiId: string; wordId: string; correct: boolean } | null>(null);
  // Not rendered directly (only feeds onComplete's per-card scoring), so a
  // ref avoids both an extra render per mismatch and the stale-closure trap
  // a piece of state read inside the setTimeout below would have.
  const wrongIdsRef = useRef<Set<string>>(new Set());
  // Guards against onComplete firing twice — matchedIds only ever grows, so
  // once it reaches cards.length it stays there, but the effect below still
  // re-runs on every subsequent render (e.g. a late setFlash/setSelected*
  // from the same evaluate() call) unless this flag stops the second call.
  const completedRef = useRef(false);

  // The actual completion side effect belongs here, not inside the
  // setMatchedIds updater below — calling onComplete (which calls
  // setComplete in the parent MatchApp) from inside another component's
  // state updater is what produced "Cannot update a component while
  // rendering a different component": the updater runs during MatchBoard's
  // own render/commit, so a setState it triggers on the parent lands
  // mid-render there too. An effect runs strictly after commit, which is
  // the safe place for this.
  useEffect(() => {
    if (completedRef.current || matchedIds.size === 0 || matchedIds.size !== cards.length) return;
    completedRef.current = true;
    onComplete(cards.map((c) => ({ cardId: c.id, firstTryCorrect: !wrongIdsRef.current.has(c.id) })));
  }, [matchedIds, cards, onComplete]);

  function evaluate(emojiCardId: string, wordCardId: string) {
    const correct = emojiCardId === wordCardId;
    setFlash({ emojiId: emojiCardId, wordId: wordCardId, correct });
    if (!correct) {
      wrongIdsRef.current.add(emojiCardId);
      wrongIdsRef.current.add(wordCardId);
    }

    window.setTimeout(
      () => {
        setFlash(null);
        setSelectedEmojiId(null);
        setSelectedWordId(null);
        if (!correct) return;
        setMatchedIds((prev) => new Set(prev).add(emojiCardId));
      },
      correct ? CORRECT_FLASH_MS : WRONG_FLASH_MS
    );
  }

  function selectTile(side: Side, cardId: string) {
    if (matchedIds.has(cardId) || flash) return;
    if (side === "emoji") {
      if (selectedEmojiId === cardId) {
        setSelectedEmojiId(null);
        return;
      }
      setSelectedEmojiId(cardId);
      if (selectedWordId) evaluate(cardId, selectedWordId);
    } else {
      if (selectedWordId === cardId) {
        setSelectedWordId(null);
        return;
      }
      setSelectedWordId(cardId);
      if (selectedEmojiId) evaluate(selectedEmojiId, cardId);
    }
  }

  function tileState(side: Side, cardId: string): "idle" | "selected" | "correct" | "wrong" {
    if (flash && (side === "emoji" ? flash.emojiId : flash.wordId) === cardId) {
      return flash.correct ? "correct" : "wrong";
    }
    if ((side === "emoji" ? selectedEmojiId : selectedWordId) === cardId) return "selected";
    return "idle";
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-1 flex-col gap-2">
        {emojiTiles
          .filter((card) => !matchedIds.has(card.id))
          .map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => selectTile("emoji", card.id)}
              className={`flex h-14 touch-manipulation select-none items-center justify-center rounded-xl border text-3xl transition-colors ${tileClass(tileState("emoji", card.id))}`}
            >
              {card.emoji}
            </button>
          ))}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {wordTiles
          .filter((card) => !matchedIds.has(card.id))
          .map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => selectTile("word", card.id)}
              className={`flex h-14 touch-manipulation select-none items-center justify-center rounded-xl border px-2 text-center text-sm font-medium transition-colors ${tileClass(tileState("word", card.id))}`}
            >
              {card.russian}
            </button>
          ))}
      </div>
    </div>
  );
}
