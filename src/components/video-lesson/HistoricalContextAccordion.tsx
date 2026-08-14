"use client";

import { memo, useState } from "react";
import type { HistoricalSection } from "@/lib/video-lesson/types";

function HistoricalContextAccordion({ sections }: { sections: HistoricalSection[] }) {
  const [openId, setOpenId] = useState<string | null>(sections[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      {sections.map((section) => {
        const isOpen = openId === section.id;
        return (
          <div key={section.id} className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : section.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-medium hover:bg-black/[.03] dark:hover:bg-white/[.05]"
            >
              {section.title}
              <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {isOpen && (
              <div className="flex flex-col gap-3 border-t border-black/10 px-4 py-4 text-sm leading-relaxed text-foreground/80 dark:border-white/10">
                {section.bodyEs.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(HistoricalContextAccordion);
