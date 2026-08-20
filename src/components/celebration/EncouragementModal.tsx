"use client";

import { useEffect, useState } from "react";
import ScenarioStage from "./ScenarioStage";
import { scenarioIdsFor, type ScenarioId } from "./catalog";
import { createScenarioPicker, pickRandomFrom } from "./pickScenario";
import { playEncouragementTone } from "@/lib/sound";

// A separate pool and a separate picker/history from CelebrationModal's —
// the two outcomes never mix, and a "matryoshka" win pick shouldn't count
// against a "matryoshka-balalaika-string-snap" fail pick ever showing up,
// or vice versa.
const EVERYDAY_FAIL_POOL = scenarioIdsFor("fail", "everyday");
const pickFreshFailScenario = createScenarioPicker(EVERYDAY_FAIL_POOL);

/** CelebrationModal's fail-side counterpart: a failed lesson check gets its
 * own small moment instead of just red text — the same catalog/
 * ScenarioStage machinery, a separate "fail"-outcome pool (see
 * catalog/index.ts), no confetti, and a gentler synthesized cue
 * (playEncouragementTone in lib/sound.ts) instead of the win jingle. The
 * humor is the point: a bear sulking about a wrong answer reads as
 * self-aware, not punitive, which is what keeps a "you failed" screen from
 * feeling discouraging. */
export default function EncouragementModal({
  open,
  title,
  subtitle,
  ctaLabel,
  onClose,
  exclamations = [],
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  onClose: () => void;
  exclamations?: string[];
}) {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>(pickFreshFailScenario);
  const [exclamation, setExclamation] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveScenario(pickFreshFailScenario());
    setExclamation(exclamations.length > 0 ? pickRandomFrom(exclamations) : null);
    playEncouragementTone();
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
      <div
        className="celebration-panel relative flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl border border-amber-500/30 bg-background p-8 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ScenarioStage id={activeScenario} />
        {exclamation && (
          <span className="text-sm font-bold uppercase tracking-wide text-foreground/50">
            {exclamation}
          </span>
        )}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-foreground/70">{subtitle}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/[.06]"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
