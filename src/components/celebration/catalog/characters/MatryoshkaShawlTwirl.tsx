"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SHAWL_BASE = "#d63b2f";
const SHAWL_TRIM = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.6s, part of the combined `shawl-twirl` animation, one
//     -shot bloom): the shawl pops open overhead — the same easing curve
//     as catalog/patterns/Shawl.tsx's `shawl-unfurl`, just folded into a
//     single class since one element can only carry one `animation`
//     shorthand at a time (a second class's `animation` property would
//     silently replace the first instead of layering on top of it).
//   Loop (0.6s onward, same class): once open, it keeps spinning flat
//     above her head — the doll herself stays still underneath, all the
//     motion is in the fabric.
/** EVERYDAY-tier win scenario: a matryoshka doll twirling a Pavlovo
 * Posad-style floral shawl overhead. Reuses MatryoshkaAvatar for the face;
 * the shawl's entrance timing/easing matches catalog/patterns/Shawl.tsx's
 * `shawl-unfurl`, combined with a continuous spin in one `shawl-twirl`
 * class (two comma-separated animations on the same shorthand). */
export default function MatryoshkaShawlTwirl() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="shawl-twirl absolute rounded-full" style={{ width: 64, height: 64, top: -6, background: SHAWL_BASE }}>
        <span className="absolute rounded-full" style={{ inset: 5, border: `2px solid ${SHAWL_TRIM}` }} />
      </span>
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_happy" size={56} />
      </div>
    </div>
  );
}
