"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BRANCH = "#5c3b26";
const LEAF = "#8a6a1e";

// Story beats:
//   Phase 1 (0.00–0.4s, `branch-droop` reused from Samovar's lid-slump
//     family, holds drooped): the whole branch tips down instead of being
//     waved level like MatryoshkaBirchBranchDance's.
//   Phase 2 (0.1–0.6s, `leaf-fall` reused from SnowballLetters.tsx's
//     falling letters, staggered ×4): the leaves tumble off one by one —
//     same fall-and-fade physics as the scattered Cyrillic letters,
//     applied to leaf shapes instead.
/** EVERYDAY-tier fail scenario: the MatryoshkaBirchBranchDance win,
 * shedding leaves instead of waving them. Same branch/leaf vocabulary,
 * reuses two existing keyframes wholesale under new class names. */
export default function MatryoshkaBirchBranchWilt() {
  return (
    <div className="relative flex h-28 items-center justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </div>

      <div className="relative" style={{ height: 44, width: 56 }}>
        <span className="branch-droop absolute left-0" style={{ top: 0, width: 40, height: 4, background: BRANCH, transformOrigin: "0% 50%" }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="leaf-fall absolute rounded-full"
            style={{ width: 12, height: 8, left: 4 + i * 10, top: 2, background: LEAF, borderRadius: "60% 60% 50% 50% / 80% 80% 30% 30%", animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
