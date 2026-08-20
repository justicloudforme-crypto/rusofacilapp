"use client";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";
const PEG = "#3a2a20";
const SOUR = "#d63b2f";

// Story beats:
//   Loop (0–1s, `string-sag`, staggered ×3): the three strings droop and
//     go slack instead of holding taut like BalalaikaParty's — a
//     detuned instrument, not a strummed one.
//   Loop (0–1s, `sour-note-wobble` reused): a flat-note glyph wobbles and
//     dims next to the neck, same wrong-note motion as AccordionHiccups.
/** EVERYDAY-tier fail scenario: the balalaika shape from Bear.tsx/
 * BalalaikaParty.tsx, visibly out of tune instead of being played well —
 * same body/neck/string vocabulary, no player attached. */
export default function BalalaikaOutOfTune() {
  return (
    <div className="relative flex h-24 w-full max-w-[200px] items-end justify-center" aria-hidden="true">
      <span className="sour-note-wobble absolute select-none text-lg font-bold" style={{ top: "10%", right: "26%", color: SOUR }}>
        ♭
      </span>

      <div className="relative" style={{ width: 60, height: 76 }}>
        <span className="absolute inset-0" style={{ background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute rounded-full" style={{ width: 16, height: 16, left: "42%", bottom: "94%", background: PEG }} />
        <span className="absolute" style={{ width: 10, height: 46, left: "45%", bottom: "56%", background: NECK }} />
        <span className="string-sag absolute" style={{ width: 2, height: 40, left: "30%", bottom: "16%", background: STRING, opacity: 0.85, transformOrigin: "50% 0%", animationDelay: "0s" }} />
        <span className="string-sag absolute" style={{ width: 2, height: 40, left: "50%", bottom: "16%", background: STRING, opacity: 0.85, transformOrigin: "50% 0%", animationDelay: "0.2s" }} />
        <span className="string-sag absolute" style={{ width: 2, height: 40, left: "70%", bottom: "16%", background: STRING, opacity: 0.85, transformOrigin: "50% 0%", animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
