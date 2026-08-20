"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.15s, `bear-huff`): the bear gives one short indignant
//     shake — the moment the wrong answer lands.
//   Phase 2 (0.15–0.65s, `ushanka-toss`): the hat lifts straight off the
//     head and arcs sideways-down, tumbling once on the way — thrown, not
//     dropped.
//   Phase 3 (0.5–0.85s, `ushanka-thud`, applied to the hat after it lands):
//     one small squash-bounce, like it actually hit the floor.
//   Held pose (from 0.65s): bald head, flat unimpressed mouth. No arms —
//     keeping the silhouette simple is what sells "sulking", not "acting".
/** EVERYDAY-tier fail scenario: the CelebrationBear cast (catalog/
 * characters/Bear.tsx), minus the balalaika, having a small dramatic
 * moment about a wrong answer. */
export default function BearTossesUshanka() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="bear-huff relative" style={{ width: 90, height: 84 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", left: "8%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", right: "8%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "62%", aspectRatio: "1", top: "28%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "40%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
          {/* Flat, unimpressed mouth — deliberately straight, not a frown,
              so it reads as "done with this" rather than "sad". */}
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "24%", height: "3px", top: "70%", background: INK, opacity: 0.6 }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "60%", height: "34%", bottom: 0, background: FUR }} />

        <span className="ushanka-toss absolute left-1/2" style={{ top: "6%", width: 40, height: 32, marginLeft: -20, transformOrigin: "50% 100%" }}>
          {/* One shared squash wrapper for the whole hat, rather than
              repeating the thud animation on each piece separately. */}
          <span className="ushanka-thud relative block h-full w-full">
            <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, left: -3, background: HAT_FUR }} />
            <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, right: -3, background: HAT_FUR }} />
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 36, height: 8, top: 4, background: HAT_TRIM, borderRadius: 9999 }} />
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 32, height: 16, top: -6, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          </span>
        </span>
      </div>
    </div>
  );
}
