"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SQUEAK = "#2d5f8a";

// Story beats:
//   Phase 1 (0.00–0.5s, `matryoshka-top-squeak-off`, holds off-frame): the
//     top half pops loose and rockets straight up out of the picture —
//     far more violent than MatryoshkaNestOpen.tsx's controlled parting.
//   Loop (0.2s onward, `dizzy-spin` reused from MatryoshkaDizzySpin.tsx,
//     on the bottom half): the leftover base spins hard side to side in
//     place, same wobble already used for the dizzy scenario.
/** EVERYDAY-tier fail scenario: the MatryoshkaNestOpen win, gone
 * comically wrong — the top half squeaks away entirely, leaving the
 * bottom spinning by itself. Reuses MatryoshkaAvatar and the dizzy-spin
 * keyframe wholesale. */
export default function MatryoshkaSpookSpin() {
  return (
    <div className="relative flex h-28 items-end justify-center overflow-hidden" aria-hidden="true">
      <span className="matryoshka-top-squeak-off absolute" style={{ width: 60, height: 30, top: 0, left: "50%", marginLeft: -30, clipPath: "inset(0 0 50% 0)" }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={60} />
      </span>
      <span className="matryoshka-top-squeak-off absolute select-none text-xs font-bold" style={{ top: -4, left: "62%", color: SQUEAK, animationDelay: "0.05s" }}>
        !
      </span>

      <div className="dizzy-spin relative" style={{ width: 60, height: 30, overflow: "hidden" }}>
        <span className="absolute inset-0" style={{ clipPath: "inset(50% 0 0 0)" }}>
          <MatryoshkaAvatar id="matryoshka_calm" size={60} />
        </span>
      </div>
    </div>
  );
}
