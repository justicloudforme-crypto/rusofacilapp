"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const PAN_BODY = "#2a1d16";
const PAN_HANDLE = "#3a2a20";
const PANCAKE = "#e0a934";
const PANCAKE_SPOT = "#c9962e";

// Story beats:
//   Loop (0–0.6s, `pancake-toss-arc`): the blini leaves the skillet,
//     arcs up above the pan, and lands back in it right as the loop
//     restarts — a catch, not a drop.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed to the catch): a
//     shine pops right as the pancake lands back in the pan.
/** EVERYDAY-tier win scenario: a doll flipping a blini in a skillet — a
 * Maslenitsa nod, paired with the everyday CelebrationPancakes scenario
 * (catalog/home/Pancakes.tsx) but with a doll doing the tossing instead of
 * the pancake flipping in place. Reuses MatryoshkaAvatar for the face. */
export default function MatryoshkaPancakeFlip() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_wink" size={52} />
      </div>

      <div className="relative" style={{ width: 84, height: 40 }}>
        <span
          className="pancake-toss-arc absolute rounded-full"
          style={{ width: 36, height: 10, left: 20, bottom: 18, background: PANCAKE }}
        >
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 8, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 20, background: PANCAKE_SPOT, opacity: 0.6 }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: 2, left: "40%", animationDelay: "0.55s" }}>
          ✨
        </span>

        <span className="absolute rounded-full" style={{ width: 68, height: 18, left: 4, bottom: 0, background: PAN_BODY }} />
        <span className="absolute" style={{ width: 26, height: 6, right: -18, bottom: 6, background: PAN_HANDLE, borderRadius: 9999 }} />
      </div>
    </div>
  );
}
