"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const PANCAKE = "#e0a934";
const PANCAKE_SPOT = "#c9962e";

// Story beats:
//   Phase 1 (0.00–0.35s, `pancake-face-fly`, holds flattened): instead of
//     arcing into a boomerang loop like MatryoshkaPancakeBoomerang.tsx's,
//     the blini flies straight at the viewer and squashes flat mid-air —
//     the flight and the flatten are combined into one keyframe (rather
//     than reusing PancakeSplat.tsx's separate `splat-flatten` class
//     alongside it) because a second class's `animation` shorthand would
//     silently replace this one instead of layering on top of it — the
//     same conflict documented in MatryoshkaShawlTwirl.tsx.
//   Loop (0.3s onward, `avatar-flinch` reused, on the doll behind it): a
//     single startled flinch the instant it lands.
/** EVERYDAY-tier fail scenario: the MatryoshkaPancakeBoomerang win,
 * landing on a face instead of a plate. Reuses the avatar-flinch keyframe
 * wholesale. */
export default function PancakeFaceSplat() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </span>

      <span
        className="pancake-face-fly absolute rounded-full"
        style={{ width: 40, height: 40, background: PANCAKE, opacity: 0.92 }}
      >
        <span className="absolute rounded-full" style={{ width: 6, height: 4, top: 10, left: 12, background: PANCAKE_SPOT, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 6, height: 4, top: 10, right: 12, background: PANCAKE_SPOT, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 6, height: 4, bottom: 10, left: "50%", marginLeft: -3, background: PANCAKE_SPOT, opacity: 0.6 }} />
      </span>
    </div>
  );
}
