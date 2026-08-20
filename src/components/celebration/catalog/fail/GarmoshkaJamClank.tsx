"use client";

const WOOD = "#5c3b26";
const BELLOWS_LIGHT = "#e0a934";
const BELLOWS_DARK = "#c9962e";
const BUTTON = "#241c15";
const CRACK = "#241c15";
const CLANK = "#c9c9c9";

// Story beats:
//   Phase 1 (0.00–0.4s, `garmoshka-jam-freeze`, holds mid-squeeze): the
//     bellows stop dead partway through a squeeze instead of breathing
//     freely like GarmoshkaStretchTune.tsx's — jammed, not playing.
//   Loop (0.2s onward, `crack-flicker` reused from NalichnikiCrack.tsx): a
//     jagged tear line across the jammed bellows flickers in and out,
//     same half-there motion as the cracked window glass.
//   Loop (0–0.6s, `comic-shiver` reused, on a small "CLANK" burst):
//     a little metallic clank mark rattles next to the jam.
/** EVERYDAY-tier fail scenario: the GarmoshkaStretchTune win, seized up
 * instead of breathing freely. Same bellows vocabulary; reuses the
 * crack-flicker keyframe from catalog/fail/NalichnikiCrack.tsx wholesale
 * for the tear line. */
export default function GarmoshkaJamClank() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="relative">
        <div className="garmoshka-jam-freeze flex items-stretch" style={{ height: 52 }}>
          <span className="rounded-l-lg" style={{ width: 16, background: WOOD }} />
          <span className="relative flex items-stretch overflow-hidden">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ width: 6, background: i % 2 === 0 ? BELLOWS_LIGHT : BELLOWS_DARK }} />
            ))}
            <span className="crack-flicker absolute inset-0" style={{ background: `linear-gradient(100deg, transparent 40%, ${CRACK} 44%, transparent 48%)` }} />
          </span>
          <span className="relative rounded-r-lg" style={{ width: 20, background: WOOD }}>
            <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 6, left: 5, background: BUTTON }} />
            <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 16, left: 9, background: BUTTON }} />
            <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 26, left: 5, background: BUTTON }} />
            <span className="absolute rounded-full" style={{ width: 5, aspectRatio: "1", top: 36, left: 9, background: BUTTON }} />
          </span>
        </div>

        <span className="comic-shiver absolute select-none text-xs font-bold" style={{ top: -14, left: 24, color: CLANK }}>
          ✺
        </span>
      </div>
    </div>
  );
}
