"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BASE_SHADE = "#d8d0c2";

// Story beats:
//   Phase 1 (0.00–0.4s, `topple-over-fall`, holds flat on her side): the
//     doll rocks one swing too far and doesn't come back — the opposite
//     outcome of MatryoshkaSteadyRock.tsx's always-recovers rock, same
//     weighted-base setup.
/** EVERYDAY-tier fail scenario: the неваляшка (roly-poly) matryoshka from
 * MatryoshkaSteadyRock.tsx, losing the balance she's built for. Reuses
 * MatryoshkaAvatar for the face and the same oval base shape. */
export default function MatryoshkaToppleOver() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="topple-over-fall relative" style={{ width: 60, height: 68, transformOrigin: "50% 100%" }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 44, height: 14, bottom: -4, background: BASE_SHADE, opacity: 0.6 }} />
      </div>
    </div>
  );
}
