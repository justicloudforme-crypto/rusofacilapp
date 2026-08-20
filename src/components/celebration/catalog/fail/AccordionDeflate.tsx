"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.5s, `accordion-deflate`, holds collapsed): instead of
//     AccordionHiccups' stuttering jerks, the bellows just sigh flat in one
//     slow squeeze and stay there — no bounce back, no second wind.
/** EVERYDAY-tier fail scenario: the CelebrationAccordion running fully out
 * of air. Same body as catalog/music/Accordion.tsx and
 * catalog/fail/AccordionHiccups.tsx, but the failure here is a total
 * collapse rather than a stutter. */
export default function AccordionDeflate() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="accordion-deflate flex items-stretch" style={{ height: 52, transformOrigin: "center" }}>
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
