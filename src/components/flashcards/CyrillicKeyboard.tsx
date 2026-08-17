"use client";

import { useCallback, useRef, type MouseEvent, type TouchEvent } from "react";

// Compact on-screen Cyrillic keyboard for the recall trainer — a phone's
// system keyboard usually isn't set to Russian, and asking a Spanish-
// speaking learner to switch input languages mid-exercise is a bigger
// obstacle than typing on-screen. Letters only (no digits/punctuation):
// answers here are always single words.
const ROWS: string[][] = [
  ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
  ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
  ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю", "ё"],
];

// Every key needs this pair: touch-manipulation disables the mobile
// browser's ~300ms tap delay (used to detect a double-tap-to-zoom gesture,
// which this viewport never disables since normal pages should stay
// pinch-zoomable) — without it, each tap visibly waits on that timer before
// the click even fires. select-none stops a fast double-tap from also
// triggering iOS's text-selection magnifier, which was compounding the
// same perceived lag.
const KEY_BASE = "touch-manipulation select-none transition-colors active:bg-foreground/10 hover:bg-foreground/5";

export interface CyrillicKeyboardDict {
  backspaceLabel: string;
  spaceLabel: string;
}

export default function CyrillicKeyboard({
  dict,
  onKey,
  onBackspace,
  onSpace,
}: {
  dict: CyrillicKeyboardDict;
  onKey: (letter: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
}) {
  // Stable handler per letter so tapping doesn't re-create (and re-bind)
  // all 33 button callbacks on every keystroke.
  const handleKey = useCallback((e: MouseEvent<HTMLButtonElement>) => onKey(e.currentTarget.value), [onKey]);

  // Backstop behind touch-action: manipulation above, not a replacement for
  // it — every clickable element in the keyboard now has touch-action set,
  // but this guards against any browser that doesn't fully honor it. Only
  // blocks when two touches land close together in both time AND position:
  // a genuine double-tap-on-the-same-spot (what triggers zoom) vs. two
  // different keys tapped quickly while typing fast, which must still both
  // register — blocking on time alone would swallow the second keystroke.
  const lastTouchRef = useRef({ time: 0, x: 0, y: 0 });
  const DOUBLE_TAP_MS = 350;
  const DOUBLE_TAP_DISTANCE_PX = 24;
  const handleTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    const now = Date.now();
    const last = lastTouchRef.current;
    const dx = touch.clientX - last.x;
    const dy = touch.clientY - last.y;
    const sameSpot = Math.hypot(dx, dy) < DOUBLE_TAP_DISTANCE_PX;
    if (now - last.time < DOUBLE_TAP_MS && sameSpot) e.preventDefault();
    lastTouchRef.current = { time: now, x: touch.clientX, y: touch.clientY };
  }, []);

  return (
    // touch-manipulation on the containers too, not just the buttons — a
    // fast double-tap that lands a pixel off a small key (on the row's
    // gap/padding rather than the button itself) was still reaching an
    // element with the browser's default touch-action, letting the
    // double-tap-to-zoom gesture fire from there instead.
    <div
      className="flex touch-manipulation flex-col items-center gap-1.5"
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "manipulation" }}
    >
      {ROWS.map((row, i) => (
        <div key={i} className="flex touch-manipulation gap-1">
          {row.map((letter) => (
            <button
              key={letter}
              type="button"
              value={letter}
              onClick={handleKey}
              className={`flex h-11 w-7 items-center justify-center rounded-lg border border-black/10 bg-background text-sm font-medium sm:h-12 sm:w-8 dark:border-white/15 ${KEY_BASE}`}
            >
              {letter}
            </button>
          ))}
        </div>
      ))}
      {/* Grid with a fixed fr ratio instead of flex-grow — flex-grow let the
          unconstrained backspace button absorb space's max-width overflow
          and balloon to most of the row; grid-cols keeps the 7:3 split
          exact regardless of content or viewport width. Multi-word answers
          are expected in this trainer (idiom-style phrases), so space stays
          the dominant key, not a token afterthought. */}
      <div className="grid w-full touch-manipulation grid-cols-[7fr_3fr] gap-1.5">
        <button
          type="button"
          onClick={onSpace}
          aria-label={dict.spaceLabel}
          className={`h-11 rounded-lg border border-black/10 bg-background text-sm font-medium sm:h-12 dark:border-white/15 ${KEY_BASE}`}
        />
        <button
          type="button"
          onClick={onBackspace}
          aria-label={dict.backspaceLabel}
          className={`flex h-11 items-center justify-center rounded-lg border border-black/10 bg-background text-lg font-medium sm:h-12 dark:border-white/15 ${KEY_BASE}`}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
