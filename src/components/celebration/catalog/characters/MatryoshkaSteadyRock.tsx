"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BASE_SHADE = "#d8d0c2";

// Story beats:
//   Loop (0–0.9s, `roly-poly-rock`): the doll tips a good 12 degrees to
//     each side and swings back through center every time — a wider,
//     steadier arc than MatryoshkaYoga.tsx's small balance-wobble, because
//     a неваляшка (roly-poly toy) is built to rock hard and still never
//     fall.
//   Loop (0–0.9s, `sparkle-twinkle` reused, on each pass through center):
//     a glint marks the moment she swings back upright.
/** EVERYDAY-tier win scenario: a matryoshka built like a неваляшка
 * (weighted roly-poly toy) — rocking confidently side to side and always
 * landing back on balance. Reuses MatryoshkaAvatar for the face; the wide
 * oval base is what a roly-poly's weighted bottom looks like at this
 * scale. */
export default function MatryoshkaSteadyRock() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="roly-poly-rock relative" style={{ width: 60, height: 68, transformOrigin: "50% 100%" }}>
        <MatryoshkaAvatar id="matryoshka_proud" size={56} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 44, height: 14, bottom: -4, background: BASE_SHADE, opacity: 0.6 }} />
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -4, left: "50%", marginLeft: -8, animationDelay: "0.45s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
