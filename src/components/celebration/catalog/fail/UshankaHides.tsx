"use client";

const FUR = "#8a5a3a";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.35s, `ushanka-pull-down`, holds): the whole hat —
//     band, crown, and flaps together — slides straight down until the
//     band covers the eyes entirely. No more face to see.
//   Loop (0.35s onward, `comic-shiver`): the whole bear vibrates in a
//     tight, fast tremor — smaller and quicker than BearTossesUshanka's
//     one-off huff, because this one doesn't stop.
/** EVERYDAY-tier fail scenario: instead of throwing the hat off
 * (BearTossesUshanka), this bear does the opposite — hides inside it. */
export default function UshankaHides() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="comic-shiver relative" style={{ width: 90, height: 84 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", left: "8%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", right: "8%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "62%", aspectRatio: "1", top: "28%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "40%", top: "50%", background: MUZZLE }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "66%", background: INK }} />

          {/* The hat: sits normally at rest, then slides down over the
              whole face on `ushanka-pull-down`. */}
          <span className="ushanka-pull-down absolute left-1/2 -translate-x-1/2" style={{ top: "-14%", width: "84%", height: "70%" }}>
            <span className="absolute rounded-b-full" style={{ width: "17%", height: "50%", top: "48%", left: "-6%", background: HAT_FUR }} />
            <span className="absolute rounded-b-full" style={{ width: "17%", height: "50%", top: "48%", right: "-6%", background: HAT_FUR }} />
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "100%", height: "26%", top: "38%", background: HAT_TRIM, borderRadius: 9999 }} />
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "94%", height: "44%", top: 0, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          </span>
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "60%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
