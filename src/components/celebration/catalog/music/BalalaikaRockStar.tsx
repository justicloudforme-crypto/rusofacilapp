"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";
const SUNGLASSES = "#241c15";
const SPARKLE_COLORS = ["#fff8ec", "#e0a934", "#d63b2f"];

// Story beats:
//   Phase 1 (0.00–0.3s, `sunglasses-drop-on`, holds): a pair of dark
//     lenses drops down from above the doll's face and lands in place —
//     the "too cool for this" reveal.
//   Loop (0.3s onward, `rockstar-headbang`): the doll bobs its head in a
//     small, steady headbang.
//   Loop (0.3s onward, `sparkler-flare`, ×5 staggered along the strings):
//     little white-gold-red sparks flare and vanish along the strings, one
//     after another — Bengal-light sparklers, not a strum.
/** MILESTONE-tier win scenario: the everyday CelebrationMatryoshka's
 * balalaika, dialed up to arena-rock. Reuses MatryoshkaAvatar for the doll
 * and the same balalaika silhouette used across the other music
 * scenarios. */
export default function BalalaikaRockStar() {
  const sparkles = [8, 16, 24, 32, 40];
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="rockstar-headbang relative">
        <MatryoshkaAvatar id="matryoshka_proud" size={56} />
        <span
          className="sunglasses-drop-on absolute rounded"
          style={{ width: 30, height: 9, top: 22, left: 13, background: SUNGLASSES }}
        />
      </div>

      <div className="relative" style={{ width: 48, height: 64 }}>
        <span className="absolute inset-x-0 bottom-0" style={{ height: 30, background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 9, height: 32, bottom: 28, background: NECK }} />
        {[34, 44, 54].map((left) => (
          <span key={left} className="absolute" style={{ width: 2, height: 26, left: `${left}%`, bottom: 12, background: STRING, opacity: 0.6 }} />
        ))}
        {sparkles.map((top, i) => (
          <span
            key={i}
            className="sparkler-flare absolute select-none text-xs"
            style={{ top, left: `${30 + (i % 3) * 14}%`, color: SPARKLE_COLORS[i % SPARKLE_COLORS.length], animationDelay: `${i * 0.16}s` }}
          >
            ✦
          </span>
        ))}
      </div>
    </div>
  );
}
