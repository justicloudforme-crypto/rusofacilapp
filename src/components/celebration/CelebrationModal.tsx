"use client";

import { useEffect, useState } from "react";
import Confetti from "./Confetti";
import ScenarioStage from "./ScenarioStage";
import { scenarioIdsFor, type ScenarioId } from "./catalog";
import { createScenarioPicker, pickRandomFrom } from "./pickScenario";
import { playSuccessJingle } from "@/lib/sound";

// Everyday passes (lesson/round completion) randomize across every win
// scenario tagged "everyday" in the catalog — see catalog/index.ts for the
// actual list and for what it takes to add another one. "streak"/
// "milestone" ids are excluded here on purpose: they're reserved for a
// flow to request explicitly via the `variant` prop, so they still read as
// special rather than blending into the everyday rotation.
const EVERYDAY_WIN_POOL = scenarioIdsFor("win", "everyday");
const pickFreshWinScenario = createScenarioPicker(EVERYDAY_WIN_POOL);

/** Generic "you did it" celebration overlay — lesson/exam passed, streak
 * milestone, badge earned, etc. Deliberately takes plain strings rather
 * than a dict slice of its own, so any flow can drive it with whatever
 * copy fits (see ExercisesTab for the lesson-pass usage).
 *
 * `variant` picks the hero scenario by catalog id (see catalog/index.ts):
 * leave it unset for an everyday pass and one is rolled fresh every time
 * the modal opens (so repeat visits feel different, not stale); pass an
 * explicit id (e.g. "bear", "matryoshka-kazachok-parade") to pin a
 * specific streak/milestone-tier scene. `exclamations` is a
 * locale-appropriate pool of short phrases (see
 * dict.celebration.exclamations) — one is picked at random on each open
 * and shown as a kicker above `title`.
 *
 * The scenario itself is loaded on demand via ScenarioStage (next/dynamic
 * under the hood) — this component never imports catalog components
 * directly, so the catalog can grow to hundreds of entries with zero
 * effect on this component or on any bundle a visitor hasn't triggered.
 * Pure CSS/Tailwind animation throughout (see globals.css) — no animation
 * library — plus a synthesized (not file-based) jingle on open, see
 * lib/sound.ts. See also EncouragementModal, the fail-side counterpart
 * for a failed lesson check. */
export default function CelebrationModal({
  open,
  title,
  subtitle,
  scoreLabel,
  ctaLabel,
  onClose,
  variant,
  exclamations = [],
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Optional pill under the title, e.g. "9/10 (90%)". */
  scoreLabel?: string;
  ctaLabel: string;
  onClose: () => void;
  variant?: ScenarioId;
  exclamations?: string[];
}) {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(
    () => variant ?? pickFreshWinScenario(),
  );
  const [exclamation, setExclamation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Re-roll the scene/phrase and replay the jingle only on the actual
    // open transition — not on every re-render while it stays open, and
    // not when the caller's `exclamations` array identity happens to
    // change without the modal itself opening.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveScenario(variant ?? pickFreshWinScenario());
    setExclamation(exclamations.length > 0 ? pickRandomFrom(exclamations) : null);
    playSuccessJingle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="animate-celebration-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Confetti />
      <div
        className="celebration-panel relative flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-black/10 bg-background p-8 text-center shadow-xl dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <ScenarioStage id={activeScenario} />
        {exclamation && (
          <span className="text-sm font-bold uppercase tracking-wide text-brand-accent">
            {exclamation}
          </span>
        )}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-foreground/70">{subtitle}</p>}
        {scoreLabel && (
          <span className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {scoreLabel}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="tap mt-2 w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 active:bg-foreground/85"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
