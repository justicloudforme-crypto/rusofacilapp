"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const WATER = "#2d5f8a";
const FISH_BODY = "#c7dff0";
const DROPLET = "#c7dff0";

// Story beats:
//   Loop (0–0.5s, `pike-leap-up` — the fish-reel-up keyframe from
//     BearIceFishing.tsx, reused wholesale): the pike rises straight up
//     out of the water, same physical rise already used for a caught
//     fish.
//   Loop (0–0.5s, `splash-pop` reused from BearFishSlipsAway.tsx,
//     staggered ×3): droplets pop around the water's surface as it
//     breaks through.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed to the leap's peak):
//     the granted wish sparkles the instant the pike clears the surface —
//     a nod to "По щучьему велению" (By the Pike's Will).
/** STREAK-tier win scenario: a magic pike surfacing to grant a wish.
 * Reuses MatryoshkaAvatar, the fish-reel-up rise (as `.pike-leap-up`),
 * splash-pop, and sparkle-twinkle wholesale. */
export default function MatryoshkaPikeWishGrant() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_thinking" size={52} />
      </div>

      <div className="relative" style={{ width: 60, height: 60 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 56, height: 12, bottom: 0, background: WATER, opacity: 0.5 }} />
        {[0, 1, 2].map((i) => (
          <span key={i} className="splash-pop absolute rounded-full" style={{ width: 4, height: 4, bottom: 8, left: `${28 + i * 8}%`, background: DROPLET, animationDelay: `${0.1 + i * 0.1}s` }} />
        ))}

        <span className="pike-leap-up absolute left-1/2" style={{ bottom: 6, width: 26, height: 12, marginLeft: -20 }}>
          <span className="absolute rounded-full" style={{ width: 26, height: 12, background: FISH_BODY, clipPath: "polygon(0% 50%, 80% 0%, 100% 50%, 80% 100%)" }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: -8, right: 4, animationDelay: "0.4s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
