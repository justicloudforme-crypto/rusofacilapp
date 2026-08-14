"use client";

import { useEffect, useState } from "react";
import {
  GLOSSARY_SEEN_CHANGE_EVENT,
  getMasteredTermCount,
  getSeenTermCount,
  loadGlossaryTerms,
} from "@/lib/glossary-client";

/**
 * Two-tier progress bar for the /glossary page — lightweight gamification
 * so a self-taught student has a visible sense of coverage. Two segments
 * rather than one count: "vistos" (card opened at least once) in the brand
 * color, "dominados" (answered correctly in TermQuiz, a strict subset of
 * "vistos") in emerald on top of it — so a glance distinguishes "I've seen
 * this" from "I actually know this". Updates live within the tab through a
 * custom event, since the native `storage` event only fires in other tabs.
 */
export default function GlossaryProgress({
  seenLabel,
  masteredLabel,
}: {
  seenLabel: string;
  masteredLabel: string;
}) {
  const [total, setTotal] = useState<number | null>(null);
  const [seen, setSeen] = useState(0);
  const [mastered, setMastered] = useState(0);

  useEffect(() => {
    loadGlossaryTerms().then((terms) => setTotal(terms.length));
    function refresh() {
      setSeen(getSeenTermCount());
      setMastered(getMasteredTermCount());
    }
    refresh();
    window.addEventListener(GLOSSARY_SEEN_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(GLOSSARY_SEEN_CHANGE_EVENT, refresh);
  }, []);

  if (total === null || total === 0) return null;

  const seenPct = Math.round((Math.min(seen, total) / total) * 100);
  const masteredPct = Math.round((Math.min(mastered, total) / total) * 100);

  return (
    <div className="mb-5">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand/50 transition-[width] duration-300 dark:bg-brand-light/50"
          style={{ width: `${seenPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${masteredPct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs font-medium text-foreground/60">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          {masteredLabel.replace("{count}", String(mastered)).replace("{total}", String(total))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand/50 dark:bg-brand-light/50" aria-hidden />
          {seenLabel.replace("{count}", String(seen)).replace("{total}", String(total))}
        </span>
      </div>
    </div>
  );
}
