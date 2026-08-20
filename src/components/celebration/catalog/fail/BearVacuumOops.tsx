"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const CLOTH = "#fff8ec";
const CLOTH_TRIM = "#d63b2f";
const BRANCH = "#5c3b26";
const LEAF = "#4a7a3a";

// Story beats:
//   Phase 1 (0.00–0.5s, `vacuum-suck-pull`, staggered ×3 for the
//     tablecloth/branch/paw, holds pulled in): instead of BearBerryGather's
//     one neat pick, everything nearby gets yanked toward his snout at
//     once — a tablecloth corner, a leafy branch, even his own paw.
//   Loop (0.3s onward, `comic-shiver` reused, on the bear): once tangled,
//     he wobbles in place, stuck.
/** EVERYDAY-tier fail scenario: the BearBerryGather win, gone comically
 * overboard — instead of one careful pick, he inhales everything within
 * reach and knots himself up. Reuses comic-shiver wholesale. */
export default function BearVacuumOops() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="comic-shiver relative" style={{ width: 90, height: 88 }}>
        <span className="vacuum-suck-pull absolute" style={{ width: 20, height: 14, top: 30, left: -14, background: CLOTH, animationDelay: "0s" }}>
          <span className="absolute inset-x-0 bottom-0" style={{ height: 3, background: CLOTH_TRIM }} />
        </span>
        <span className="vacuum-suck-pull absolute rounded-full" style={{ width: 22, height: 8, top: 40, right: -16, background: BRANCH, animationDelay: "0.12s" }}>
          <span className="absolute rounded-full" style={{ width: 10, height: 6, top: -3, right: 2, background: LEAF }} />
        </span>
        <span className="vacuum-suck-pull absolute rounded-full" style={{ width: 16, height: 16, top: 52, left: 4, background: FUR, animationDelay: "0.24s" }} />

        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "20%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "20%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "16%", height: "11%", top: "58%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
