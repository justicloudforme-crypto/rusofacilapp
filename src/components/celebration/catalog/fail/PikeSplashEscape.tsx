"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const WATER = "#2d5f8a";
const FISH_BODY = "#c7dff0";
const DROPLET = "#c7dff0";

// Story beats:
//   Loop (0–0.5s, `splash-pop` reused from BearFishSlipsAway.tsx,
//     staggered ×4, bigger burst than the win scene): the pike surfaces
//     just long enough to splash her, no wish granted.
//   Phase (0.2–0.6s, `pike-dive-escape` — the fish-slip-away keyframe from
//     BearFishSlipsAway.tsx, reused wholesale): it sinks back under
//     before anything can be asked of it.
//   Loop (0.3s onward, `avatar-flinch` reused, on the doll): a single
//     startled flinch at the splash.
/** EVERYDAY-tier fail scenario: the MatryoshkaPikeWishGrant win, all
 * splash and no wish. Reuses splash-pop, fish-slip-away, and
 * avatar-flinch wholesale — no new keyframes needed. */
export default function PikeSplashEscape() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={52} />
      </span>

      <div className="relative" style={{ width: 60, height: 60 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 56, height: 12, bottom: 0, background: WATER, opacity: 0.5 }} />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="splash-pop absolute rounded-full" style={{ width: 4, height: 4, bottom: 8, left: `${20 + i * 12}%`, background: DROPLET, animationDelay: `${0.05 + i * 0.08}s` }} />
        ))}

        <span className="pike-dive-escape absolute left-1/2" style={{ bottom: 6, width: 26, height: 12, marginLeft: -12 }}>
          <span className="absolute rounded-full" style={{ width: 26, height: 12, background: FISH_BODY, clipPath: "polygon(0% 50%, 80% 0%, 100% 50%, 80% 100%)" }} />
        </span>
      </div>
    </div>
  );
}
