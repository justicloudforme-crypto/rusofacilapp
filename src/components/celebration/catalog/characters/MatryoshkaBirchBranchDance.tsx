"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BRANCH = "#5c3b26";
const LEAF = "#4a7a3a";

// Story beats:
//   Loop (0–0.9s, `leaf-flutter` — the same stagger used for
//     MatryoshkaRibbonDance's ribbon segments): a row of small birch leaves
//     along the branch rock a few degrees out of phase with their
//     neighbors, reading as a light breeze rather than five leaves
//     wiggling in unison.
/** EVERYDAY-tier win scenario: a doll waving a leafy birch branch — a nod
 * to Semik/Troitsa birch-branch folk dances. Reuses MatryoshkaAvatar for
 * the face and the ribbon-flutter stagger keyframe wholesale, just on
 * leaf shapes instead of ribbon segments. */
export default function MatryoshkaBirchBranchDance() {
  return (
    <div className="relative flex h-28 items-center justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_happy" size={56} />
      </div>

      <div className="relative flex items-center" style={{ height: 44, width: 56 }}>
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: 4, background: BRANCH }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="leaf-flutter absolute rounded-full"
            style={{
              width: 14,
              height: 9,
              left: 4 + i * 10,
              top: 8 + (i % 2) * 22,
              background: LEAF,
              borderRadius: "60% 60% 50% 50% / 80% 80% 30% 30%",
              transformOrigin: "0% 50%",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
