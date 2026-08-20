"use client";

const FRAME = "#2d5f8a";
const CARVING = "#e0a934";
const GLASS = "#fff8ec";
const CRACK = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.4s, `frame-peel-left` / `frame-peel-right`, mirrored):
//     the carved frame's two side posts peel outward and droop, like the
//     wood finally gave up on its joints — the opposite of Nalichniki.tsx's
//     tidy bloom-in.
//   Loop (0.3s onward, `crack-flicker`, on the glass crack): a jagged crack
//     across the glass flickers in and out, half-there like it might
//     finish splitting any second.
/** EVERYDAY-tier fail scenario: the carved window frame from
 * Nalichniki.tsx coming apart at the seams instead of shining. Same
 * frame/carving/glass vocabulary, no new shapes beyond the crack line. */
export default function NalichnikiCrack() {
  return (
    <div className="relative flex h-24 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 78 }}>
        <span className="frame-peel-left absolute" style={{ left: -4, top: 0, bottom: 0, width: 6, background: FRAME, transformOrigin: "top" }} />
        <span className="frame-peel-right absolute" style={{ right: -4, top: 0, bottom: 0, width: 6, background: FRAME, transformOrigin: "top" }} />
        <span className="absolute inset-x-0 top-0" style={{ height: 5, background: FRAME }} />
        <span className="absolute inset-x-0 bottom-0" style={{ height: 5, background: FRAME }} />

        <span className="absolute inset-1.5" style={{ background: GLASS }}>
          <span className="crack-flicker absolute inset-0" style={{ background: `linear-gradient(105deg, transparent 46%, ${CRACK} 48%, transparent 50%, transparent 60%, ${CRACK} 62%, transparent 64%)` }} />
        </span>
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", top: -3, left: -3, background: CARVING, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", top: -3, right: -3, background: CARVING, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", bottom: -3, left: -3, background: CARVING, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 6, aspectRatio: "1", bottom: -3, right: -3, background: CARVING, opacity: 0.6 }} />
      </div>
    </div>
  );
}
