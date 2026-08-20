"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";

// Story beats:
//   Loop (0–0.7s, `ushanka-victory-toss`): the hat launches straight up
//     off the head, spins a full turn, and comes back down to land exactly
//     where it started — the happy mirror image of BearTossesUshanka's
//     one-way, never-returns throw.
//   Loop (0–1.6s, `bear-bounce` reused): the bear underneath keeps up a
//     small triumphant bounce the whole time, same idle motion as
//     catalog/characters/Bear.tsx.
/** EVERYDAY-tier win scenario: the bear celebrates by tossing his own
 * ushanka in the air and catching it — same fur/hat vocabulary as
 * BearTossesUshanka.tsx (fail), staged as a deliberate contrast: thrown in
 * triumph here instead of in a huff, and it always comes back. */
export default function BearUshankaVictoryToss() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="bear-bounce relative" style={{ width: 90, height: 84 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", left: "8%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "22%", right: "8%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "62%", aspectRatio: "1", top: "28%", background: FUR }}>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "40%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "40%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "26%", height: "10%", top: "66%", background: INK, opacity: 0.55, borderRadius: "0 0 9999px 9999px" }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "60%", height: "34%", bottom: 0, background: FUR }} />

        <span className="ushanka-victory-toss absolute left-1/2" style={{ top: "6%", width: 40, height: 32, marginLeft: -20, transformOrigin: "50% 100%" }}>
          <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, left: -3, background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: 8, height: 16, top: 8, right: -3, background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 36, height: 8, top: 4, background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 32, height: 16, top: -6, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
        </span>
      </div>
    </div>
  );
}
