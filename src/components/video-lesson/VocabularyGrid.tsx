import { memo } from "react";
import type { VocabularyCard } from "@/lib/video-lesson/types";

function VocabularyGrid({ cards }: { cards: VocabularyCard[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/10"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{card.word}</span>
            <span className="text-xs uppercase tracking-wide text-foreground/40">{card.partOfSpeech}</span>
          </div>
          <p className="text-sm text-foreground/80">{card.translation}</p>
          <div className="mt-1 border-t border-black/10 pt-2 text-xs leading-relaxed dark:border-white/10">
            <p className="italic">{card.exampleRu}</p>
            <p className="text-foreground/60">{card.exampleEs}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default memo(VocabularyGrid);
