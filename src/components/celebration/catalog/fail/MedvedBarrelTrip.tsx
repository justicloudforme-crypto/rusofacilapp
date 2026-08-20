"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BARREL = "#5c3b26";
const BARREL_BAND = "#3a2a20";

// Story beats:
//   Phase 1 (0.00–0.35s, `bear-trip-lurch` reused from BearDropsPelmeni.tsx,
//     holds tilted): the bear lurches forward mid-step, caught off guard
//     by a bochonok (small wooden barrel) in his path.
//   Loop (0–0.5s, `barrel-roll-away`): the barrel itself tips and rolls a
//     short distance, wobbling as it goes — the thing that tripped him
//     doesn't just sit there afterward.
/** EVERYDAY-tier fail scenario: a fairground bear (ярмарочный медведь)
 * tripping over a stray barrel — a stumble, not the BearHoneyBarrelStuck
 * scene of being wedged inside one. Reuses the bear-trip-lurch keyframe
 * wholesale. */
export default function MedvedBarrelTrip() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="bear-trip-lurch relative" style={{ width: 66, height: 66, transformOrigin: "50% 100%" }}>
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

      <span className="barrel-roll-away relative rounded-md" style={{ width: 28, height: 34, background: BARREL }}>
        <span className="absolute inset-x-0" style={{ top: 6, height: 4, background: BARREL_BAND }} />
        <span className="absolute inset-x-0" style={{ bottom: 6, height: 4, background: BARREL_BAND }} />
      </span>
    </div>
  );
}
