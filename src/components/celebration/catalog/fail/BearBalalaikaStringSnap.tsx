"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";

// Story beats:
//   Phase 1 (0.00–0.35s, `string-stretch` reused from
//     MatryoshkaBalalaikaStringSnap.tsx): the middle string stretches
//     upward, visibly overtightened.
//   Phase 2 (0.35s, `string-snap-left` / `string-snap-right` reused):
//     it splits and both halves curl away — identical snap physics to the
//     doll's version, just on the bear's balalaika instead of a held one.
//   Phase 3 (from 0.35s, `bear-huff` reused): a single indignant shake the
//     instant it breaks.
/** EVERYDAY-tier fail scenario: the BearBalalaikaFireside win, losing a
 * string mid-song. Same fur/ushanka/balalaika vocabulary; reuses the
 * exact string-snap keyframes from catalog/fail/
 * MatryoshkaBalalaikaStringSnap.tsx wholesale — the same reuse pattern
 * already used once for GusliStringSnap.tsx. */
export default function BearBalalaikaStringSnap() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="bear-huff relative" style={{ width: 66, height: 66 }}>
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
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "20%", height: "3px", top: "60%", background: INK, opacity: 0.6 }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>

      <div className="relative" style={{ width: 44, height: 60 }}>
        <span className="absolute inset-x-0 bottom-0" style={{ height: 34, background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 8, height: 30, bottom: 30, background: NECK }} />

        <span className="string-stretch absolute left-1/2 -translate-x-1/2" style={{ width: 2, height: 26, bottom: 12, background: STRING }} />
        <span className="string-snap-left absolute left-1/2" style={{ width: 2, height: 12, bottom: 30, marginLeft: -1, background: STRING, transformOrigin: "bottom" }} />
        <span className="string-snap-right absolute left-1/2" style={{ width: 2, height: 12, bottom: 30, marginLeft: -1, background: STRING, transformOrigin: "bottom" }} />

        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 12, marginLeft: -8, background: STRING, opacity: 0.5 }} />
        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 12, marginLeft: 6, background: STRING, opacity: 0.5 }} />
      </div>
    </div>
  );
}
