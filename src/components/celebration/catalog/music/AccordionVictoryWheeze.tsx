"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";
const SPARK = "#e0a934";

// Story beats:
//   Loop (0–1.4s, `accordion-victory-stretch`): the bellows stretch out
//     much wider than the everyday CelebrationAccordion's gentle squeeze,
//     hold at full extension for a beat like a drawn-out final chord, then
//     snap back — a "ta-DAAA" instead of a steady wheeze.
//   One-shot (fires each time the bellows reach full stretch, via a second
//     animation on the same timeline, `victory-spark-pop` staggered ×2):
//     two little sparks pop at the accordion's ends on the held note.
/** EVERYDAY-tier win scenario: the calm CelebrationAccordion (catalog/
 * music/Accordion.tsx) hits its big triumphant note. */
export default function AccordionVictoryWheeze() {
  const pleats = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="accordion-victory-stretch relative flex items-stretch" style={{ height: 52 }}>
        <span className="rounded-l-lg" style={{ width: 16, background: WOOD }} />
        <span className="flex items-stretch overflow-hidden">
          {pleats.map((i) => (
            <span key={i} style={{ width: 6, background: i % 2 === 0 ? BELLOWS_LIGHT : BELLOWS_DARK }} />
          ))}
        </span>
        <span className="relative rounded-r-lg" style={{ width: 20, background: WOOD }}>
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 6, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 16, left: 9, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 26, left: 5, background: BUTTON }} />
          <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 36, left: 9, background: BUTTON }} />
        </span>
        <span className="victory-spark-pop absolute rounded-full" style={{ width: 8, aspectRatio: "1", left: -4, top: 4, background: SPARK, animationDelay: "0.5s" }} />
        <span className="victory-spark-pop absolute rounded-full" style={{ width: 8, aspectRatio: "1", right: -4, bottom: 4, background: SPARK, animationDelay: "0.65s" }} />
      </div>
    </div>
  );
}
