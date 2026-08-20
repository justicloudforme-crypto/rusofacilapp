"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const RIBBON_COLORS = ["#d63b2f", "#e0a934", "#2d5f8a", "#4a7a3a", "#d63b2f"];

// Story beats:
//   Loop (0–0.9s, `ribbon-flutter`, staggered ×5 along the chain): a chain
//     of small ribbon segments each rock a few degrees out of phase with
//     its neighbors — one segment's peak is the next one's trough, which
//     is what reads as a flowing ribbon wave instead of five dots
//     wiggling in unison.
/** EVERYDAY-tier win scenario: a doll waving a long rhythmic-gymnastics-
 * style ribbon overhead. Reuses MatryoshkaAvatar for the face; the ribbon
 * itself is a chain of small rotated segments, no new curve/path
 * vocabulary needed. */
export default function MatryoshkaRibbonDance() {
  return (
    <div className="relative flex h-28 items-center justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_laughing" size={56} />
      </div>

      <div className="relative flex items-center" style={{ height: 40 }}>
        {RIBBON_COLORS.map((color, i) => (
          <span
            key={i}
            className="ribbon-flutter inline-block rounded-full"
            style={{ width: 14, height: 6, marginLeft: i === 0 ? 0 : -3, background: color, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
    </div>
  );
}
