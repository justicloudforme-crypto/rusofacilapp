"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";
const SNOW_SHADE = "#d8d0c2";

// Story beats:
//   Loop (0–1s, `giant-ball-rollover`): instead of growing beside him
//     like BearSnowballGrowGiant.tsx's, the ball is already huge and
//     rolls straight across, right over where he's standing.
//   Loop (0.4s onward, `nap-flop` reused from SleepyBearNaps.tsx, on the
//     bear): he settles into a flat little heap the instant it passes —
//     same collapse already used for giving up on a lesson, standing in
//     here for "flattened".
/** EVERYDAY-tier fail scenario: the BearSnowballGrowGiant win, run over
 * by its own snowball instead of finishing it triumphantly. Reuses
 * nap-flop wholesale; only the rolling ball itself is new. */
export default function BearSnowballFlatten() {
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      <div className="nap-flop relative" style={{ width: 70, height: 40, transformOrigin: "50% 100%" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 60, height: 30, bottom: 0, background: FUR }} />
        <span className="absolute rounded-full" style={{ width: 14, aspectRatio: "1", bottom: 20, left: 2, background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 22, height: 16, bottom: 6, background: MUZZLE }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 3, bottom: 16, left: "40%", background: INK }} />
      </div>

      <span className="giant-ball-rollover absolute rounded-full" style={{ width: 70, height: 70, bottom: -6, background: SNOW }}>
        <span className="absolute rounded-full" style={{ width: 16, height: 16, top: 10, left: 12, background: SNOW_SHADE, opacity: 0.6 }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 40, height: 10, top: -4, background: HAT_TRIM, opacity: 0.5 }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 36, height: 20, top: -10, background: HAT_FUR, opacity: 0.5, borderRadius: "50% 50% 0 0" }} />
      </span>
    </div>
  );
}
