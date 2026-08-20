"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const EGG_BASE = "#fff8ec";
const PETAL_COLORS = ["#d63b2f", "#e0a934", "#241c15"];
const PETAL_COUNT = 5;

// Story beats:
//   Loop (0–0.5s, `khokhloma-petal` reused, staggered ×5): five painted
//     motifs bloom onto the egg's surface one after another, same
//     petal-blossom keyframe as the wreath in MatryoshkaFlorist.tsx —
//     here arranged down the egg's curve instead of around a head.
/** EVERYDAY-tier win scenario: a doll finishing a hand-painted decorative
 * egg. Reuses MatryoshkaAvatar for the face and the khokhloma-petal bloom
 * keyframe for the pattern appearing on the egg. */
export default function MatryoshkaPaintsEgg() {
  const petals = Array.from({ length: PETAL_COUNT }, (_, i) => i);
  return (
    <div className="relative flex h-28 items-end justify-center gap-2" aria-hidden="true">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <MatryoshkaAvatar id="matryoshka_thinking" size={52} />
      </div>

      <div className="relative" style={{ width: 40, height: 54 }}>
        <span className="absolute inset-0 rounded-full" style={{ background: EGG_BASE, borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" }} />
        {petals.map((i) => (
          <span
            key={i}
            className="khokhloma-petal absolute rounded-full"
            style={{
              width: 8,
              height: 8,
              top: 8 + i * 8,
              left: i % 2 === 0 ? "28%" : "56%",
              background: PETAL_COLORS[i % PETAL_COLORS.length],
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
