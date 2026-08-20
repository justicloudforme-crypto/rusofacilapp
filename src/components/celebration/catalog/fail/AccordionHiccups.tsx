"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";
const SOUR = "#d63b2f";

// Story beats:
//   Loop (0–0.6s, `accordion-hiccup`): the bellows jerk in short,
//     unequal-length steps instead of one smooth squeeze — a stutter, not
//     a rhythm. Every "hiccup" lands on a different beat than the last.
//   Loop (0–1s, `sour-note-wobble`, on a small red note glyph): the wrong
//     note wobbles and dims instead of floating cleanly away — it knows
//     it's wrong.
/** EVERYDAY-tier fail scenario: the calm CelebrationAccordion (catalog/
 * music/Accordion.tsx) — and its triumphant AccordionVictoryWheeze
 * counterpart — malfunctioning instead of performing. */
export default function AccordionHiccups() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="accordion-hiccup flex items-stretch" style={{ height: 52 }}>
        <span className="rounded-l-lg" style={{ width: 16, background: WOOD }} />
        <span className="flex items-stretch overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} style={{ width: 6, background: i % 2 === 0 ? BELLOWS_LIGHT : BELLOWS_DARK }} />
          ))}
        </span>
        <span className="relative rounded-r-lg" style={{ width: 20, background: WOOD }}>
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 6, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 16, left: 9, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 26, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 36, left: 9, background: BUTTON }} />
        </span>
      </div>
      <span className="sour-note-wobble absolute select-none text-lg font-bold" style={{ top: "8%", right: "18%", color: SOUR }}>
        ♭
      </span>
    </div>
  );
}
