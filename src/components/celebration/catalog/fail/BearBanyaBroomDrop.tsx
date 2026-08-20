"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";
const HANDLE = "#5c3b26";
const LEAF = "#4a7a3a";
const TOWEL = "#fff8ec";
const TOWEL_TRIM = "#d63b2f";

// Story beats:
//   Phase 1 (0.00–0.5s, `broom-drop-fall`, holds fallen): the venik slips
//     from his paw and tumbles down instead of waving overhead — the
//     opposite trajectory of BearBanyaBroom's arc.
//   Loop (0.3s onward, `steam-fizzle` reused): the steam behind him
//     dwindles and dies out instead of drifting steadily, same fade as
//     SamovarCoolsDown's.
/** EVERYDAY-tier fail scenario: the BearBanyaBroom win, dropped instead of
 * waved. Same fur/muzzle/towel vocabulary, opposite outcome for the
 * broom. */
export default function BearBanyaBroomDrop() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <span className="steam-fizzle absolute rounded-full bg-white" style={{ width: 4, height: 16, left: "20%", top: 0 }} />

      <div className="relative" style={{ width: 66, height: 66 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "20%", height: "3px", top: "60%", background: INK, opacity: 0.6 }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "46%", height: "14%", top: "58%", background: TOWEL, borderRadius: 9999 }}>
          <span className="absolute inset-x-0 bottom-0" style={{ height: "35%", background: TOWEL_TRIM, borderRadius: 9999 }} />
        </span>
      </div>

      <span className="broom-drop-fall relative" style={{ width: 10, height: 60 }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 30, background: HANDLE }} />
        <span className="absolute inset-x-0 top-0" style={{ height: 34, background: LEAF, clipPath: "polygon(10% 100%, 0% 20%, 30% 0%, 70% 0%, 100% 20%, 90% 100%)" }} />
      </span>
    </div>
  );
}
