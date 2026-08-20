"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BUCKET = "#3a2a20";
const WATER = "#c7dff0";

// Story beats:
//   Phase 1 (0.00–0.4s, `bucket-tip-pour`, holds tipped): a bucket above
//     him rotates over and empties in one motion.
//   Phase 2 (0.15–0.5s, `honey-pour-spill` reused from BearHoneyJarSpill.tsx,
//     recolored): a stream falls straight down from the bucket's lip —
//     same physical pour, water instead of honey.
//   Phase 3 (0.35s onward, `bear-startle-jump`, holds airborne): the
//     instant the water lands, the bear jumps straight up, startled.
/** EVERYDAY-tier fail scenario: a bucket of ice water dumped on the bear
 * from above — a sharper, colder surprise than any of his other mishaps.
 * Reuses the honey-pour-spill stream keyframe wholesale. */
export default function MedvedBucketSplash() {
  return (
    <div className="relative flex h-32 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 100 }}>
        <span className="bucket-tip-pour absolute left-1/2 -translate-x-1/2 rounded-b-md" style={{ width: 24, height: 18, top: -30, background: BUCKET, transformOrigin: "50% 100%" }} />
        <span className="honey-pour-spill absolute rounded-full" style={{ width: 3, height: 0, left: "50%", marginLeft: -2, top: -14, background: WATER }} />

        <div className="bear-startle-jump relative" style={{ width: 66, height: 66, marginTop: 34 }}>
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
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "20%", height: "8%", top: "58%", background: INK, borderRadius: "50%" }} />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        </div>
      </div>
    </div>
  );
}
