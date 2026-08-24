"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound";

/** Global mute switch for CelebrationModal's jingle and AnswerPad's
 * correct/incorrect tones — a plain localStorage flag (see lib/sound.ts),
 * no server round-trip needed since it has no effect on SSR output. */
export default function SoundToggle({ onLabel, offLabel }: { onLabel: string; offLabel: string }) {
  // Starts "on" to match isSoundEnabled()'s SSR-safe default, then syncs to
  // the real localStorage value right after mount — same pattern as
  // ExercisesTab's localStorage-backed "already passed" check.
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // Reading localStorage is only possible after mount — same pattern as
    // ExercisesTab's "already passed" check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(isSoundEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? onLabel : offLabel}
      title={enabled ? onLabel : offLabel}
      className="tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base text-foreground/70 transition-colors hover:bg-black/[.04] hover:text-foreground active:bg-black/[.04] active:text-foreground dark:hover:bg-white/[.06] dark:active:bg-white/[.06]"
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
    </button>
  );
}
