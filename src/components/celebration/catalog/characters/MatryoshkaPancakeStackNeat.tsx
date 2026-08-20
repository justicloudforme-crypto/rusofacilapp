"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const PANCAKE_COLORS = ["#c9962e", "#e0a934", "#c9962e"];

// Story beats:
//   Loop (0–0.5s, `doll-cascade-in` reused from Matryoshka.tsx, staggered
//     ×3 as `.pancake-stack-piece`): three blini bounce into place on the
//     plate one after another, same settle-in bounce used for the doll
//     cascade — landing neatly, not tossed.
//   Loop (0–0.9s, `sparkle-twinkle` reused, on the finished stack): a
//     shine marks the stack's completion.
/** EVERYDAY-tier win scenario: a doll neatly stacking blini onto a plate,
 * one at a time. Reuses MatryoshkaAvatar for the face and doll-cascade-in
 * wholesale for each pancake's landing. */
export default function MatryoshkaPancakeStackNeat() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_calm" size={52} />
      </div>

      <div className="relative flex flex-col-reverse items-center">
        {PANCAKE_COLORS.map((color, i) => (
          <span
            key={i}
            className="pancake-stack-piece rounded-full"
            style={{ width: 44 - i * 2, height: 9, background: color, marginBottom: i === 0 ? 0 : -3, animationDelay: `${i * 0.15}s` }}
          />
        ))}
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: -14, right: -8, animationDelay: "0.55s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
