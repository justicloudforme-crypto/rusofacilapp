"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

// Story beats:
//   Phase 1 (0.00–0.5s, `matryoshka-halves-part`, on the outer shell,
//     holds parted): the outer doll's top half lifts and slides aside
//     smoothly — no snap, no rush.
//   Phase 2 (0.3–0.8s, `doll-cascade-in` reused from Matryoshka.tsx, on
//     the inner doll): the smaller doll inside pops into view right as
//     the gap opens wide enough — same bounce-in used for the everyday
//     cascade scenario.
/** EVERYDAY-tier win scenario: a doll opening smoothly to reveal the
 * smaller one nested inside — the calm, controlled counterpart to
 * MatryoshkaSpookSpin.tsx's runaway version. Reuses MatryoshkaAvatar and
 * doll-cascade-in wholesale. */
export default function MatryoshkaNestOpen() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 60 }}>
        <span className="matryoshka-halves-part absolute inset-0 overflow-hidden" style={{ clipPath: "inset(0 0 50% 0)" }}>
          <MatryoshkaAvatar id="matryoshka_calm" size={60} />
        </span>
        <span className="absolute inset-0" style={{ clipPath: "inset(50% 0 0 0)" }}>
          <MatryoshkaAvatar id="matryoshka_calm" size={60} />
        </span>

        <span className="doll-cascade-piece absolute left-1/2 top-1/2" style={{ marginLeft: -14, marginTop: -14, animationDelay: "0.35s" }}>
          <MatryoshkaAvatar id="matryoshka_happy" size={28} />
        </span>
      </div>
    </div>
  );
}
