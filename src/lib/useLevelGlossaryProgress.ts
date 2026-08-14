"use client";

import { useEffect, useState } from "react";
import { GLOSSARY_SEEN_CHANGE_EVENT, getMasteredTermSlugs } from "@/lib/glossary-client";
import type { GlossaryTermData } from "@/components/glossary/GlossaryApp";

export interface LevelGlossaryProgress {
  /** null while the level's term list is still loading. */
  mastered: number | null;
  total: number | null;
  /** True the instant `mastered` first reaches `total` (fires once per
   * mount, not on every render at 100%) — the signal a "just completed"
   * celebration hooks into. Call `dismissCelebration()` once shown, or it
   * stays true and the celebration would re-trigger on the next render. */
  justCompleted: boolean;
  dismissCelebration: () => void;
}

/**
 * Single source of truth for "how much of this level's glossary vocabulary
 * has the student mastered" — used by both LevelGlossaryBadge (on
 * /courses) and the level page's progress bar (on /courses/[level]), which
 * previously each fetched `/api/glossary?level=X` and recomputed the same
 * mastered-count logic independently. Centralizing it here means a future
 * third call site doesn't need a third copy.
 */
export function useLevelGlossaryProgress(level: string): LevelGlossaryProgress {
  const [state, setState] = useState<{ mastered: number; total: number } | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let levelTerms: GlossaryTermData[] = [];
    let wasComplete = false;

    function evaluate() {
      if (cancelled || levelTerms.length === 0) return;
      const mastered = new Set(getMasteredTermSlugs());
      const masteredCount = levelTerms.filter((term) => mastered.has(term.slug)).length;
      const isComplete = masteredCount >= levelTerms.length;
      if (isComplete && !wasComplete) setJustCompleted(true);
      wasComplete = isComplete;
      setState({ mastered: masteredCount, total: levelTerms.length });
    }

    fetch(`/api/glossary?level=${level}`)
      .then((res) => (res.ok ? res.json() : { terms: [] }))
      .then((body: { terms?: GlossaryTermData[] }) => {
        levelTerms = body.terms ?? [];
        // Seed wasComplete from the first read so a level that was *already*
        // fully mastered before this mount doesn't fire a false celebration.
        const mastered = new Set(getMasteredTermSlugs());
        wasComplete = levelTerms.length > 0 && levelTerms.every((term) => mastered.has(term.slug));
        evaluate();
      })
      .catch(() => {});

    window.addEventListener(GLOSSARY_SEEN_CHANGE_EVENT, evaluate);
    return () => {
      cancelled = true;
      window.removeEventListener(GLOSSARY_SEEN_CHANGE_EVENT, evaluate);
    };
  }, [level]);

  return {
    mastered: state?.mastered ?? null,
    total: state?.total ?? null,
    justCompleted,
    dismissCelebration: () => setJustCompleted(false),
  };
}
