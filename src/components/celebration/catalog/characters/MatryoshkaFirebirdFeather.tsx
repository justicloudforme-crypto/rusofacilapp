"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const QUILL = "#e6c9a0";
const GLOW_COLORS = ["#d63b2f", "#e0a934", "#d63b2f"];

// Story beats:
//   Loop (0–0.6s, `sparkler-wave` reused from MatryoshkaSparkler.tsx): the
//     feather arcs side to side overhead, same wave motion as the bengal
//     sparkler.
//   Loop (0–0.8s, `sparkler-flare` reused from BalalaikaRockStar.tsx,
//     staggered ×3): warm flare bursts ripple along the feather's edge —
//     the жар-птица (firebird) glow, built from the same flare keyframe
//     used for sparks elsewhere in the catalog.
/** STREAK-tier win scenario: a doll holding up a glowing firebird feather
 * (жар-птица folklore) — reuses MatryoshkaAvatar for the face and both the
 * sparkler-wave and sparkler-flare keyframes wholesale, just recolored
 * warmer and held higher than the everyday sparkler scene. */
export default function MatryoshkaFirebirdFeather() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_proud" size={56} />
      </div>

      <span className="sparkler-wave relative" style={{ width: 8, height: 64, transformOrigin: "50% 100%" }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 30, background: QUILL }} />
        <span className="absolute inset-x-0 top-0" style={{ height: 40, background: GLOW_COLORS[0], clipPath: "polygon(50% 0%, 100% 40%, 70% 100%, 30% 100%, 0% 40%)", opacity: 0.85 }} />
        {GLOW_COLORS.map((color, i) => (
          <span
            key={i}
            className="sparkler-flare absolute rounded-full"
            style={{ width: 5, height: 5, top: 2 + i * 10, left: i % 2 === 0 ? -4 : 8, background: color, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </span>
    </div>
  );
}
