"use client";

import type { WordGloss } from "@/lib/video-lesson/types";
import { useUiStrings } from "@/lib/use-ui-strings";

export default function WordTooltip({ gloss, onClose }: { gloss: WordGloss; onClose: () => void }) {
  const t = useUiStrings().videoLesson;
  return (
    <div className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-black/10 bg-background p-3 text-left shadow-lg dark:border-white/15">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{gloss.lemma}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.closeLabel}
          className="tap text-foreground/40 hover:text-foreground/70 active:text-foreground/70"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-foreground/40">{gloss.partOfSpeech}</p>
      <p className="mt-1 text-sm text-foreground/90">{gloss.translation}</p>
      {gloss.grammarNote && (
        <p className="mt-2 border-t border-black/10 pt-2 text-xs text-foreground/60 dark:border-white/30">
          {gloss.grammarNote}
        </p>
      )}
    </div>
  );
}
