"use client";

const SNOW = "#f2ede3";
const COAL = "#241c15";
const CARROT = "#e0a934";
const BLUSH = "#d63b2f";
const PUDDLE = "#c7dff0";

// Story beats:
//   Phase 1 (0.00–0.7s, `snowman-melt-shrink`, holds shrunk): the whole
//     stack sinks and narrows in place — not toppling like SnowballLetters,
//     just visibly shrinking with embarrassment.
//   Phase 1 (0.00–0.7s, `puddle-grow`, in lockstep): a puddle beneath him
//     widens at the same pace as the shrink, so the "lost height" reads as
//     "turned into water" rather than just scaling down.
//   Loop (0–1s, `sour-note-wobble` reused): the two blush dots on his face
//     pulse, borrowed wholesale from AccordionHiccups' wrong-note wobble —
//     same "can't hide how flustered this is" motion.
/** EVERYDAY-tier fail scenario: the SnowmanDisco/SnowballLetters snowman,
 * mortified enough to visibly melt a little. Same three-ball silhouette;
 * the embarrassment is a puddle and a blush, not a fall. */
export default function SnowmanMeltsBlush() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <span className="puddle-grow absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 70, height: 14, background: PUDDLE, opacity: 0.7 }} />

      <div className="snowman-melt-shrink relative" style={{ width: 70, height: 84, transformOrigin: "50% 100%" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 62, height: 62, bottom: 6, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 44, height: 44, bottom: 52, background: SNOW }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 30, height: 30, bottom: 84, background: SNOW }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 102, left: "42%", background: COAL }} />
        <span className="absolute rounded-full" style={{ width: 5, height: 5, bottom: 102, left: "54%", background: COAL }} />
        <span className="absolute" style={{ bottom: 96, left: "50%", width: 0, height: 0, borderStyle: "solid", borderWidth: "4px 6px 4px 0", borderColor: `transparent ${CARROT} transparent transparent` }} />
        <span className="sour-note-wobble absolute rounded-full" style={{ width: 8, height: 6, bottom: 96, left: "26%", background: BLUSH }} />
        <span className="sour-note-wobble absolute rounded-full" style={{ width: 8, height: 6, bottom: 96, right: "26%", background: BLUSH, animationDelay: "0.2s" }} />
      </div>
    </div>
  );
}
