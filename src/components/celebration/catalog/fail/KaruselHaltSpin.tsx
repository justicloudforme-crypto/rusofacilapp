"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";
import type { AvatarId } from "@/lib/avatars";

const FACES: AvatarId[] = ["matryoshka_happy", "matryoshka_wink", "matryoshka_surprised"];
const ICE = "#c7dff0";

// Story beats:
//   Phase 1 (0.00–0.5s, `carousel-halt`, holds overshot): the group spins
//     fast, then jerks to a hard stop with a small overshoot wobble —
//     abrupt, unlike KaruselIceSpin.tsx's smooth continuous turn.
//   Loop (0.3s onward, `avatar-flinch` reused, on one doll): the doll that
//     was riding widest flinches, thrown off-balance by the sudden halt.
/** EVERYDAY-tier fail scenario: the KaruselIceSpin win, stopping short
 * instead of gliding. Same three-doll ring and ice-sheet vocabulary;
 * reuses the avatar-flinch keyframe wholesale for the reaction. */
export default function KaruselHaltSpin() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 90, height: 90, background: ICE, opacity: 0.3 }} />

      <div className="carousel-halt relative" style={{ width: 4, height: 4 }}>
        {FACES.map((face, i) => (
          <span key={i} className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transform: `rotate(${i * 120}deg)` }}>
            <span className={`absolute ${i === 2 ? "avatar-flinch" : ""}`} style={{ top: -40, left: -18 }}>
              <MatryoshkaAvatar id={face} size={36} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
