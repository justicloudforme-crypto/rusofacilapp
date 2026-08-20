"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const CARPET_BASE = "#2d5f8a";
const CARPET_TRIM = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.3s, `carpet-unroll-snap` reused from
//     MatryoshkaPaintedFan.tsx's fan-snap-shut, holds unrolled flat): the
//     carpet suddenly loses its shape mid-flight — same snap-shut motion
//     already used for a folding fan, applied here to a losing-tension
//     carpet instead.
//   Phase 2 (0.15–0.6s, `nap-flop` reused from SleepyBearNaps.tsx, on the
//     doll): she tips sideways and drops, same settle used for the
//     sleepy-bear fail.
//   Loop (0.3s onward, `barrel-roll-away` reused from MedvedBarrelTrip.tsx,
//     on the carpet): it rolls itself up and trundles off on its own —
//     same rolling-away physics already used for a stray barrel.
/** EVERYDAY-tier fail scenario: the MatryoshkaCarpetFlight win, losing
 * lift mid-flight. Reuses fan-snap-shut, nap-flop, and barrel-roll-away
 * wholesale — no new keyframes needed. */
export default function CarpetUnrollDump() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <span className="nap-flop relative" style={{ width: 56, height: 56, transformOrigin: "50% 100%" }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </span>

      <span className="carpet-unroll-snap relative rounded-md" style={{ width: 70, height: 14, background: CARPET_BASE, transformOrigin: "0% 100%" }}>
        <span className="barrel-roll-away absolute inset-0 rounded-md" style={{ background: CARPET_BASE }}>
          <span className="absolute inset-x-2 top-1/2 -translate-y-1/2" style={{ height: 2, background: CARPET_TRIM, opacity: 0.7 }} />
        </span>
      </span>
    </div>
  );
}
