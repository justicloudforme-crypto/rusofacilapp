"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SLED_WOOD = "#5c3b26";
const SLED_TRIM = "#e0a934";
const RUNNER = "#8a6a1e";
const SNOW = "#f2ede3";

// Story beats:
//   Loop (0–0.5s, `sled-glide`): the whole sled rocks forward-and-back and
//     bobs, the shorthand for "moving fast" without actually translating
//     the rig across the container.
//   Loop (0–0.6s, `trail-streak`, staggered ×4): dashed speed lines stream
//     out behind the runners and fade, reinforcing the motion the rock
//     alone can't sell.
/** MILESTONE-tier win scenario: three matryoshka dolls riding a troika
 * sled — bigger and busier than the everyday pool, reserved for level-ups
 * and exam passes. Dolls reuse MatryoshkaAvatar at three sizes (same
 * "biggest in front" cascade logic as characters/Matryoshka.tsx); the sled
 * itself is plain divs, no new shape vocabulary beyond a runner curve. */
export default function TroikaSled() {
  const trails = [0, 1, 2, 3];
  return (
    <div className="relative flex h-28 w-full max-w-[220px] items-end justify-center overflow-hidden" aria-hidden="true">
      {trails.map((i) => (
        <span
          key={i}
          className="trail-streak absolute"
          style={{ width: 16, height: 3, bottom: 14 + i * 6, right: "52%", background: SNOW, borderRadius: 9999, animationDelay: `${i * 0.12}s` }}
        />
      ))}

      <div className="sled-glide relative" style={{ width: 130, height: 78 }}>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1">
          <MatryoshkaAvatar id="matryoshka_laughing" size={30} />
          <MatryoshkaAvatar id="matryoshka_happy" size={38} />
          <MatryoshkaAvatar id="matryoshka_proud" size={30} />
        </span>

        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-xl" style={{ width: 108, height: 14, background: SLED_WOOD }}>
          <span className="absolute inset-x-0 top-0" style={{ height: 4, background: SLED_TRIM }} />
        </span>
        <span
          className="absolute rounded-full"
          style={{ width: 118, height: 10, bottom: -6, left: "50%", transform: "translateX(-50%)", background: RUNNER, clipPath: "polygon(6% 0%, 100% 0%, 88% 100%, 0% 100%)" }}
        />
      </div>
    </div>
  );
}
