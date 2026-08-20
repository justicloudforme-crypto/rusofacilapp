"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const STAR_COLOR = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `dizzy-spin`): the doll rocks hard side to side, further
//     and faster than MatryoshkaYoga's gentle balance-wobble — this one
//     has lost its footing, not found it.
//   Loop (0–1.2s, `dizzy-star-orbit`, staggered ×3): three little stars
//     circle her head at a fixed radius. Three levels deep on purpose: the
//     outer wrapper holds a *static* rotate (each star's starting angle
//     around the head), the middle wrapper holds the *animated* orbit
//     rotate around that same zero-size point, and the star itself is just
//     offset outward with no transform of its own — a CSS animation on
//     `transform` fully replaces any other transform on that element, so
//     "start at angle X" and "keep rotating" can't live on one span (same
//     split used in PatternBurst.tsx, just one level deeper here).
/** EVERYDAY-tier fail scenario: the doll from Matryoshka.tsx/
 * MatryoshkaYoga.tsx spun too hard and can't find straight up anymore.
 * Reuses MatryoshkaAvatar for the face. */
export default function MatryoshkaDizzySpin() {
  const stars = [0, 1, 2];
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="dizzy-spin relative" style={{ width: 60, height: 60 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={60} />
        {stars.map((i) => (
          <span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{ width: 0, height: 0, transform: `rotate(${i * 120}deg)` }}
          >
            <span className="dizzy-star-orbit absolute" style={{ width: 0, height: 0, animationDelay: `${i * 0.15}s` }}>
              <span className="absolute select-none text-xs" style={{ top: -38, left: -6, color: STAR_COLOR }}>
                ★
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
