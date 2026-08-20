"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";
const BATON = "#e6c9a0";
const BATON_TIP = "#d63b2f";

const NOTES = ["♪", "♫"];

// Story beats:
//   Loop (0–1.1s, `accordion-squeeze` reused): the bellows keep breathing
//     in and out on their own, same as catalog/music/Accordion.tsx.
//   Loop (0–0.8s, `baton-wave`): a little baton pivots side to side above
//     the accordion, like it's leading its own bellows instead of just
//     being squeezed.
//   Loop (0–1.6s, `note-float` reused, staggered ×2): notes drift up past
//     the baton's tip in time with the waving.
/** EVERYDAY-tier win scenario: the CelebrationAccordion conducting itself —
 * same body as catalog/music/Accordion.tsx, with a baton added above it
 * instead of a player. Reuses accordion-squeeze and note-float wholesale. */
export default function AccordionConductor() {
  return (
    <div className="relative flex h-28 flex-col items-center justify-end" aria-hidden="true">
      {NOTES.map((note, i) => (
        <span
          key={note + i}
          className="note-float absolute select-none text-lg font-bold"
          style={{ left: `${38 + i * 22}%`, bottom: "62%", color: i % 2 === 0 ? "var(--brand-accent)" : "var(--brand)", animationDelay: `${i * 0.4}s`, animationDuration: "1.7s" }}
        >
          {note}
        </span>
      ))}

      <span className="baton-wave absolute" style={{ width: 4, height: 34, bottom: "72%", background: BATON, transformOrigin: "50% 100%" }}>
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 6, height: 6, background: BATON_TIP }} />
      </span>

      <div className="accordion-squeeze flex items-stretch" style={{ height: 52 }}>
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
    </div>
  );
}
