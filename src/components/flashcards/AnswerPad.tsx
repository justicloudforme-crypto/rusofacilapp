"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import FolkSpark from "@/components/celebration/FolkSpark";
import CyrillicKeyboard, { type CyrillicKeyboardDict } from "./CyrillicKeyboard";
import type { RecallResult } from "@/lib/flashcards/recall-round";
import type { AvatarId } from "@/lib/avatars";
import { playCorrectTone, playIncorrectTone } from "@/lib/sound";
import { hapticSuccess, hapticError } from "@/lib/haptics";

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
  // A real device report found the previous "open by default" reasoning
  // here was solving the wrong problem: the answer box used to be a plain
  // div rather than an <input>, specifically to stop the system keyboard
  // from popping up and fighting this one — but that also meant no system
  // keyboard could ever be used at all, on any device, Cyrillic layout or
  // not. Now that the box below is a real <input> (see the isCyrillic
  // branch), the system keyboard opens on focus like any normal text
  // field; this pill+panel is purely the backup for anyone without a
  // Cyrillic layout installed, so it defaults closed again — most typing
  // now happens on the system keyboard, not this one.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const isCyrillic = alphabet === "cyrillic";
  const expectedLetter = isCyrillic ? CYRILLIC_LETTER : LATIN_LETTER;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onAnswerChange?.(answer);
  }, [answer, onAnswerChange]);

  // Best-effort autofocus for hideAnswerBox mode ("completa la frase") so
  // a physical-keyboard user can start typing immediately without an extra
  // click — purely a convenience now that the input itself is a real,
  // always-visible/tappable element (see its own comment below): if this
  // effect's focus() is ignored (e.g. a mobile browser withholding the
  // on-screen keyboard from a non-gesture focus call), the visible input
  // is still there as a guaranteed manual fallback, unlike the previous
  // sr-only version.
  useEffect(() => {
    if (hideAnswerBox) inputRef.current?.focus();
  }, [hideAnswerBox]);

  // Fires exactly once per submitted answer — `result` goes null -> a
  // result on submit, then a fresh AnswerPad instance (remounted by the
  // parent with a new `key`) starts null again for the next card, so this
  // never double-plays for the same answer.
  useEffect(() => {
    if (result === "correct" || result === "almost") {
      playCorrectTone();
      hapticSuccess();
    } else if (result === "incorrect") {
      playIncorrectTone();
      hapticError();
    }
  }, [result]);

  const appendLetter = useCallback((letter: string) => setAnswer((a) => a + letter), []);
  const appendSpace = useCallback(() => setAnswer((a) => a + " "), []);
  const backspace = useCallback(() => setAnswer((a) => a.slice(0, -1)), []);

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
        {/* One real, always-VISIBLE <input> for both alphabets — a previous
            fix made this sr-only (clipped to 1px) in hideAnswerBox mode,
            reasoning that the live answer already shows inline in the
            sentence above. That broke manual focus entirely: a 1px clipped
            box can't be clicked/tapped, so the only way in was a mount-time
            autofocus() call — which iOS/Android silently refuse to promote
            into an actual on-screen-keyboard trigger without a real user
            gesture, and which offered no recovery if focus ever moved away
            for any reason. Keeping the input visible (just narrower/
            centered in hideAnswerBox mode, since the inline preview above
            already shows the running answer) guarantees a real tappable/
            clickable target for the system keyboard AND a physical
            keyboard AND the on-screen Cyrillic panel, all at once — the
            actual requirement, not just an autofocus side effect of it. */}
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={answer}
          disabled={Boolean(result)}
          placeholder={dict.answerPlaceholder}
          onChange={(e) => setAnswer(e.target.value.split("").filter((ch) => ch === " " || expectedLetter.test(ch)).join(""))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !result) onSubmit(answer);
          }}
          className={`min-h-11 rounded-xl border px-4 py-2.5 text-lg font-medium outline-none transition-colors disabled:opacity-100 ${
            hideAnswerBox ? "w-32 text-center" : "flex-1"
          } ${answerBoxColorClass(result)} ${answerBoxMotionClass(result)}`}
        />
      </div>

      {feedbackText && <p className="-mt-3 text-sm text-foreground/70">{feedbackText}</p>}

      {result ? (
        <button
          type="button"
          onClick={onNext}
          className="touch-manipulation select-none rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {dict.nextButton}
        </button>
      ) : (
        <>
          {isCyrillic && (
            <>
              <button
                type="button"
                onClick={() => setKeyboardOpen((o) => !o)}
                aria-expanded={keyboardOpen}
                className="touch-manipulation select-none self-center rounded-full border border-primary px-4 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 active:bg-primary/10"
              >
                <span aria-hidden="true">⌨ </span>
                {keyboardOpen ? dict.hideKeyboardLabel : dict.showKeyboardLabel}
              </button>
              {keyboardOpen && (
                <CyrillicKeyboard dict={dict} onKey={appendLetter} onBackspace={backspace} onSpace={appendSpace} />
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => onSubmit(answer)}
            disabled={!answer.trim()}
            className="touch-manipulation select-none rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dict.checkButton}
          </button>
        </>
      )}
    </div>
  );
}
