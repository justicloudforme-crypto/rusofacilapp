"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import type { AvatarId } from "@/lib/avatars";

const FACES: AvatarId[] = ["matryoshka_happy", "matryoshka_wink", "matryoshka_laughing"];
const ICE = "#c7dff0";

// Story beats:
//   Loop (0–1.6s, `carousel-spin`, on the whole group): three dolls, each
//     fixed at its own 120°-apart angle by a static rotate wrapper, ride
//     around together as one continuously spinning group — the group
//     itself carries the only animated rotate, so the fixed per-doll
//     angles never fight it (same three-level split PatternBurst.tsx and
//     MatryoshkaDizzySpin.tsx use whenever a static angle and a
//     continuous spin need to share a scene).
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×3 around the ring):
//     a light trail glints behind the group as it turns.
/** STREAK-tier win scenario: dolls riding an ice carousel, spinning
 * together with a light trail — busier than the everyday pool, reserved
 * for a correct-answer streak. Reuses MatryoshkaAvatar and
 * sparkle-twinkle wholesale. */
export default function KaruselIceSpin() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 90, height: 90, background: ICE, opacity: 0.3 }} />

      <div className="carousel-spin relative" style={{ width: 4, height: 4 }}>
        {FACES.map((face, i) => (
          <span key={i} className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transform: `rotate(${i * 120}deg)` }}>
            <span className="absolute" style={{ top: -40, left: -18 }}>
              <MatryoshkaAvatar id={face} size={36} />
            </span>
            <span className="sparkle-twinkle absolute select-none text-xs" style={{ top: -14, left: -6, animationDelay: `${i * 0.2}s` }}>
              ✨
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
