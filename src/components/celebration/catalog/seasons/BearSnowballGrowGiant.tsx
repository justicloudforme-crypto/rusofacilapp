"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";
const SNOW_SHADE = "#d8d0c2";

// Story beats:
//   Loop (0–1.4s, `snowball-grow-roll`): a snowball starts tiny beside
//     him and grows steadily as it rolls and spins — bigger and slower
//     than any other snowball motion in the catalog, since this one is
//     meant to read as snowballing (accumulating), not thrown.
//   Loop (0–0.9s, `sparkle-twinkle` reused, timed to the biggest size): a
//     shine marks the moment it peaks.
//   Loop (0–1.6s, `bear-bounce` reused): a small triumphant bounce
//     throughout.
/** MILESTONE-tier win scenario: a bear rolling a snowball from tiny to
 * giant — busier and more dramatic than the everyday pool, reserved for
 * a level-up/exam/badge moment. Reuses bear-bounce and sparkle-twinkle
 * wholesale; only the growing roll itself is new. */
export default function BearSnowballGrowGiant() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-3" aria-hidden="true">
      <div className="bear-bounce relative" style={{ width: 60, height: 60 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>

      <div className="relative" style={{ width: 60, height: 60 }}>
        <span className="snowball-grow-roll absolute rounded-full" style={{ width: 40, height: 40, bottom: 0, left: "50%", marginLeft: -20, background: SNOW }}>
          <span className="absolute rounded-full" style={{ width: 10, height: 10, top: 6, left: 8, background: SNOW_SHADE, opacity: 0.6 }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: 0, right: -6, animationDelay: "0.7s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
