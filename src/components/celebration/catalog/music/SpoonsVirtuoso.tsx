"use client";

const SPOON_WOOD = "#c9962e";
const SPOON_TRIM = "#8a6a1e";
const NOTE_COLOR = "var(--brand)";

// Story beats:
//   Loop (0–0.4s, `spoons-clack`, mirrored left/right): the two ложки
//     (wooden spoons — a real Russian folk percussion instrument) rock
//     toward each other and strike bowl-to-bowl, then rock back apart.
//   Loop (0–1s, `note-float`, reused from CelebrationKalinka, staggered
//     ×2): a note pops up on alternating claps.
/** EVERYDAY-tier win scenario: no balalaika this time — a much smaller,
 * punchier instrument doing the celebrating. New character prop (ложки),
 * same story-beat convention as the rest of the catalog/music/ folder. */
export default function SpoonsVirtuoso() {
  return (
    <div className="relative flex h-24 items-center justify-center gap-1" aria-hidden="true">
      <span className="spoons-clack-left relative" style={{ width: 16, height: 60, transformOrigin: "bottom center" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 20, top: 0, background: SPOON_WOOD }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 4, height: 42, top: 18, background: SPOON_TRIM, borderRadius: 9999 }} />
      </span>
      <span className="spoons-clack-right relative" style={{ width: 16, height: 60, transformOrigin: "bottom center" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 16, height: 20, top: 0, background: SPOON_WOOD }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 4, height: 42, top: 18, background: SPOON_TRIM, borderRadius: 9999 }} />
      </span>

      <span className="note-float absolute select-none text-lg font-bold" style={{ left: "20%", top: "10%", color: NOTE_COLOR, animationDelay: "0.1s" }}>♪</span>
      <span className="note-float absolute select-none text-lg font-bold" style={{ right: "20%", top: "4%", color: NOTE_COLOR, animationDelay: "0.5s" }}>♫</span>
    </div>
  );
}
