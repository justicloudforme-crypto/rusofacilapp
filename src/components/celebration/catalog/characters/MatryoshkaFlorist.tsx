"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FLOWER_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a", "#4a7a3a", "#d63b2f", "#e0a934"];
const FLOWER_COUNT = FLOWER_COLORS.length;

// Story beats:
//   Loop (0–0.5s, `khokhloma-petal` reused, staggered ×6): six little
//     flowers bloom in one by one around the doll's head, each on its own
//     rotated wrapper — a wreath assembling itself, not appearing at once.
//   Loop (0–0.9s, `sparkle-twinkle` reused): a couple of stray sparkles pop
//     near the finished wreath once it's roughly in place.
/** EVERYDAY-tier win scenario: the doll pauses to weave herself a flower
 * wreath. Reuses MatryoshkaAvatar for the face and the same petal-blossom
 * keyframe from catalog/patterns/Khokhloma.tsx — just arranged in a ring
 * around a head instead of a center dot. */
export default function MatryoshkaFlorist() {
  const petals = Array.from({ length: FLOWER_COUNT }, (_, i) => i);
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 64, height: 64 }}>
        <MatryoshkaAvatar id="matryoshka_happy" size={64} />
        {petals.map((i) => (
          <span
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${(360 / FLOWER_COUNT) * i - 90}deg)` }}
          >
            <span
              className="khokhloma-petal absolute rounded-full"
              style={{
                width: 9,
                height: 9,
                top: -4,
                left: "50%",
                marginLeft: -4.5,
                background: FLOWER_COLORS[i],
                animationDelay: `${i * 0.08}s`,
              }}
            />
          </span>
        ))}
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -10, right: -2, animationDelay: "0.6s" }}
        >
          ✨
        </span>
      </div>
    </div>
  );
}
