"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import FolkSpark from "@/components/celebration/FolkSpark";
import CyrillicKeyboard, { type CyrillicKeyboardDict } from "./CyrillicKeyboard";
import type { RecallResult } from "@/lib/flashcards/recall-round";
import type { AvatarId } from "@/lib/avatars";
import { playCorrectTone, playIncorrectTone } from "@/lib/sound";

// A correct answer picks one of these at random (once per card) instead of
// always the same "happy" face — small, cheap variety so the approval
// reaction doesn't feel identical every time.
const CORRECT_REACTIONS: AvatarId[] = ["matryoshka_happy", "matryoshka_wink", "matryoshka_laughing", "matryoshka_proud"];

export type AnswerAlphabet = "cyrillic" | "latin";

export interface AnswerPadDict extends CyrillicKeyboardDict {
  answerPlaceholder: string;
  checkButton: string;
  nextButton: string;
  correctFeedback: string;
  almostFeedback: string; // template, contains literal "{answer}"
  incorrectFeedback: string; // template, contains literal "{answer}"
}

// Only these get typed into the answer box from a physical keyboard — an
// answer is always one word in one alphabet, so anything else (digits,
// punctuation, browser shortcuts) is ignored rather than polluting it.
const CYRILLIC_LETTER = /^[а-яё]$/i;
const LATIN_LETTER = /^[a-záéíóúñü]$/i;

function answerBoxColorClass(result: RecallResult | null): string {
  if (result === "correct") return "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (result === "almost") return "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (result === "incorrect") return "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400";
  return "border-black/10 dark:border-white/15 bg-background";
}

// A correct answer gets a small confident pop; a wrong one gets a shake —
// same "correct"/"almost"/"incorrect" states as the color above, just the
// motion half of the same feedback (pure CSS, see globals.css). "almost"
// reads as a near-miss rather than a full miss, so it shares the pop
// rather than the shake.
function answerBoxMotionClass(result: RecallResult | null): string {
  if (result === "correct" || result === "almost") return "animate-answer-pop";
  if (result === "incorrect") return "animate-answer-shake";
  return "";
}

/** The typing half of every recall-style exercise (typing trainer,
 * fill-in-the-blank): answer box, on-screen/physical keyboard, submit/next
 * buttons, colored feedback, and the matryoshka reaction. Each mode owns
 * its own prompt (what's being asked) and renders this below it — the
 * question format differs per mode, the answering mechanics don't. Reset
 * between questions happens by the parent remounting this with a fresh
 * `key` on a new card, same pattern as RecallApp used before this was
 * split out. */
export default function AnswerPad({
  dict,
  alphabet,
  correctAnswer,
  result,
  onSubmit,
  onNext,
  hideAnswerBox = false,
  onAnswerChange,
}: {
  dict: AnswerPadDict;
  alphabet: AnswerAlphabet;
  correctAnswer: string;
  result: RecallResult | null;
  onSubmit: (answer: string) => void;
  onNext: () => void;
  // When the caller renders the live answer itself (e.g. inline inside a
  // sentence blank), the box below is redundant — an extra typing target
  // users don't need. Everything else (keyboard, buttons, physical-keyboard
  // handling) still works the same; only this one box disappears.
  hideAnswerBox?: boolean;
  onAnswerChange?: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  // Picked once per card (this component remounts with a fresh `key` on
  // every new card, per the class comment above) rather than re-rolled on
  // every render.
  const [correctReaction] = useState(
    () => CORRECT_REACTIONS[Math.floor(Math.random() * CORRECT_REACTIONS.length)],
  );
  const isCyrillic = alphabet === "cyrillic";
  const expectedLetter = isCyrillic ? CYRILLIC_LETTER : LATIN_LETTER;

  useEffect(() => {
    onAnswerChange?.(answer);
  }, [answer, onAnswerChange]);

  // Fires exactly once per submitted answer — `result` goes null -> a
  // result on submit, then a fresh AnswerPad instance (remounted by the
  // parent with a new `key`) starts null again for the next card, so this
  // never double-plays for the same answer.
  useEffect(() => {
    if (result === "correct" || result === "almost") {
      playCorrectTone();
    } else if (result === "incorrect") {
      playIncorrectTone();
    }
  }, [result]);

  // Read via a ref instead of listing `answer` as an effect dependency
  // below — a dependency would tear down and re-add the window listener on
  // every single keystroke for no benefit (setAnswer already updates off
  // the latest value via its functional form; only the Enter-to-submit
  // path needs to read the current answer).
  const answerRef = useRef(answer);
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  const appendLetter = useCallback((letter: string) => setAnswer((a) => a + letter), []);
  const appendSpace = useCallback(() => setAnswer((a) => a + " "), []);
  const backspace = useCallback(() => setAnswer((a) => a.slice(0, -1)), []);

  // Cyrillic mode has no real focused <input> — the answer box is a plain
  // div so tapping it doesn't fight the on-screen CyrillicKeyboard by also
  // summoning the device's (usually Latin) system keyboard. A physical
  // keyboard still works via this global listener. Latin mode instead uses
  // a real <input> below (Latin letters need no custom keyboard, and a real
  // input is what actually opens a mobile system keyboard), so this
  // listener only attaches for Cyrillic to avoid double-typing every letter.
  useEffect(() => {
    if (result || !isCyrillic) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Backspace") {
        backspace();
      } else if (e.key === " ") {
        e.preventDefault();
        appendSpace();
      } else if (e.key === "Enter") {
        onSubmit(answerRef.current);
      } else if (e.key.length === 1 && expectedLetter.test(e.key)) {
        appendLetter(e.key);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [result, isCyrillic, expectedLetter, onSubmit, appendLetter, appendSpace, backspace]);

  const feedbackText =
    result === "correct"
      ? dict.correctFeedback
      : result === "almost"
        ? dict.almostFeedback.replace("{answer}", correctAnswer)
        : result === "incorrect"
          ? dict.incorrectFeedback.replace("{answer}", correctAnswer)
          : null;

  const avatarId =
    result === "correct" ? correctReaction : result === "almost" ? "matryoshka_thinking" : "matryoshka_surprised";

  return (
    <div className="flex touch-manipulation w-full flex-col items-center gap-6">
      <div className={`flex w-full items-center gap-3 ${hideAnswerBox ? "justify-center" : ""}`}>
        <MatryoshkaAvatar id={result ? avatarId : "matryoshka_calm"} size={48} />
        {/* A little folk-pattern reward next to a fully correct answer —
            "almost" still gets the amber near-miss treatment, not this. */}
        {result === "correct" && <FolkSpark size={22} />}
        {!hideAnswerBox &&
          (isCyrillic ? (
            <div
              className={`min-h-11 flex-1 rounded-xl border px-4 py-2.5 text-lg font-medium transition-colors ${answerBoxColorClass(result)} ${answerBoxMotionClass(result)}`}
            >
              {answer || <span className="text-foreground/30">{dict.answerPlaceholder}</span>}
            </div>
          ) : (
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={answer}
              disabled={Boolean(result)}
              placeholder={dict.answerPlaceholder}
              onChange={(e) => setAnswer(e.target.value.split("").filter((ch) => ch === " " || LATIN_LETTER.test(ch)).join(""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !result) onSubmit(answer);
              }}
              className={`min-h-11 flex-1 rounded-xl border px-4 py-2.5 text-lg font-medium outline-none transition-colors disabled:opacity-100 ${answerBoxColorClass(result)} ${answerBoxMotionClass(result)}`}
            />
          ))}
      </div>

      {feedbackText && <p className="-mt-3 text-sm text-foreground/70">{feedbackText}</p>}

      {result ? (
        <button
          type="button"
          onClick={onNext}
          className="touch-manipulation select-none rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85"
        >
          {dict.nextButton}
        </button>
      ) : (
        <>
          {isCyrillic && <CyrillicKeyboard dict={dict} onKey={appendLetter} onBackspace={backspace} onSpace={appendSpace} />}
          <button
            type="button"
            onClick={() => onSubmit(answer)}
            disabled={!answer.trim()}
            className="touch-manipulation select-none rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dict.checkButton}
          </button>
        </>
      )}
    </div>
  );
}
