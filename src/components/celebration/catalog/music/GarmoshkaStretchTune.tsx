"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";
const SPARK_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a"];

// Story beats:
//   Loop (0–1.1s, `accordion-squeeze` reused from Accordion.tsx): the
//     bellows breathe in and out, same rhythm as the calm everyday
//     scenario.
//   Loop (0–0.8s, `sparkler-flare` reused from BalalaikaRockStar.tsx,
//     staggered ×3): instead of plain note glyphs, little sparkling
//     flares pop off the bellows in time with the squeeze — what
//     separates this from Accordion.tsx and AccordionConductor.tsx is the
//     notes read as glinting sparks rather than floating text.
/** EVERYDAY-tier win scenario: a garmoshka (button accordion) in full,
 * sparkling tune — reuses the accordion-squeeze bellows wholesale and the
 * sparkler-flare keyframe from the balalaika rock-star scene for the
 * "sparkling notes" the user asked for. */
export default function GarmoshkaStretchTune() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="relative">
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

        {SPARK_COLORS.map((color, i) => (
          <span
            key={i}
            className="sparkler-flare absolute rounded-full"
            style={{ width: 5, height: 5, top: -6 - i * 4, left: 20 + i * 10, background: color, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
