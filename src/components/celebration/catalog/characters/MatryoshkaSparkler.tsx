"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const STICK = "#e6c9a0";
const SPARK_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a"];

// Story beats:
//   Loop (0–0.6s, `sparkler-wave`): the whole sparkler (stick and all)
//     arcs side to side, like it's being waved in the air rather than held
//     still.
//   Loop (0–0.8s, `sparkler-flare` reused from BalalaikaRockStar, staggered
//     ×3): little flare dots pop at the tip in quick, overlapping bursts —
//     a sparkler's shower of light, not one glow.
/** EVERYDAY-tier win scenario: the doll waving a bengal-fire sparkler.
 * Reuses MatryoshkaAvatar for the face and the existing sparkler-flare
 * keyframe (catalog/music/BalalaikaRockStar.tsx) for the flare bursts. */
export default function MatryoshkaSparkler() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_laughing" size={56} />
      </div>

      <span className="sparkler-wave relative" style={{ width: 6, height: 60, transformOrigin: "50% 100%" }}>
        <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 44, background: STICK }} />
        {SPARK_COLORS.map((color, i) => (
          <span
            key={i}
            className="sparkler-flare absolute rounded-full"
            style={{ width: 5, height: 5, top: -2 - i * 3, left: -6 + i * 6, background: color, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </span>
    </div>
  );
}
