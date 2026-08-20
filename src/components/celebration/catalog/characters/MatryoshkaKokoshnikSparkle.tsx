"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const KOKOSHNIK = "#d63b2f";
const KOKOSHNIK_TRIM = "#e0a934";
const GEM_COLORS = ["#e0a934", "#2d5f8a", "#e0a934"];

// Story beats:
//   Loop (0–0.5s, `khokhloma-petal` reused, staggered ×3): three gems set
//     into the kokoshnik (a traditional peaked headdress) bloom in one
//     after another, same petal-blossom keyframe used across the catalog
//     for "something painted/set just appeared".
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×2): loose glints
//     drift off the headdress on top of the gems themselves.
/** STREAK-tier win scenario: a close-up on a doll's kokoshnik catching the
 * light — reuses MatryoshkaAvatar for the face and the khokhloma-petal
 * bloom for the gems, one notch showier than the everyday pool. */
export default function MatryoshkaKokoshnikSparkle() {
  const gems = GEM_COLORS;
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 60 }}>
        <MatryoshkaAvatar id="matryoshka_proud" size={60} />
        <span
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: -14, width: 46, height: 22, background: KOKOSHNIK, borderRadius: "50% 50% 0 0" }}
        >
          <span className="absolute inset-x-0 bottom-0" style={{ height: 5, background: KOKOSHNIK_TRIM }} />
          {gems.map((color, i) => (
            <span
              key={i}
              className="khokhloma-petal absolute rounded-full"
              style={{ width: 7, height: 7, top: 4, left: `${22 + i * 20}%`, background: color, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: -18, right: -6, animationDelay: "0.4s" }}>
          ✨
        </span>
        <span className="sparkle-twinkle absolute select-none text-xs" style={{ top: -10, left: -8, animationDelay: "0.7s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
