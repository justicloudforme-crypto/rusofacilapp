"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const PANCAKE = "#e0a934";
const PANCAKE_SPOT = "#c9962e";
const PLATE = "#fff8ec";
const PLATE_TRIM = "#2d5f8a";

// Story beats:
//   Loop (0–0.9s, `pancake-boomerang-loop`): the blini leaves the doll's
//     hand, sails in a full circular loop above her head, and lands back
//     on the plate right as the loop restarts — a bigger, showier arc
//     than MatryoshkaPancakeFlip.tsx's simple toss-and-catch.
//   Loop (0–0.9s, `sparkle-twinkle` reused, timed to the landing): a
//     shine pops the instant the pancake settles on the plate.
/** EVERYDAY-tier win scenario: a doll landing a full boomerang-style
 * pancake toss onto a waiting plate. Reuses MatryoshkaAvatar for the face
 * and the sparkle-twinkle landing glint. */
export default function MatryoshkaPancakeBoomerang() {
  return (
    <div className="relative flex h-32 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_wink" size={52} />
      </div>

      <div className="relative" style={{ width: 60, height: 90 }}>
        <span
          className="pancake-boomerang-loop absolute rounded-full"
          style={{ width: 30, height: 9, left: "50%", marginLeft: -15, bottom: 14 }}
        >
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 6, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute rounded-full" style={{ width: 5, height: 3, top: 2, left: 16, background: PANCAKE_SPOT, opacity: 0.6 }} />
          <span className="absolute inset-0 rounded-full" style={{ background: PANCAKE }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ bottom: 12, left: "50%", marginLeft: 12, animationDelay: "0.75s" }}>
          ✨
        </span>

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full border-2" style={{ width: 46, height: 14, bottom: 0, background: PLATE, borderColor: PLATE_TRIM }} />
      </div>
    </div>
  );
}
