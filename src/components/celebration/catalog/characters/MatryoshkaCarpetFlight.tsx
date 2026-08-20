"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const CARPET_BASE = "#2d5f8a";
const CARPET_TRIM = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `carpet-glide` — the same rock-and-bob shorthand used
//     for TroikaSled.tsx's `sled-glide`, reused wholesale for a flying
//     carpet instead of a sled): the whole rig rocks forward-and-back and
//     bobs, reading as "moving fast" without ever translating across the
//     frame.
//   Loop (0–0.5s, `khokhloma-petal` reused, staggered ×3, on the carpet's
//     woven pattern): the pattern motifs bloom into view once the carpet
//     is airborne.
/** EVERYDAY-tier win scenario: a doll soaring on a flying, Khokhloma-
 * patterned carpet (ковёр-самолёт) — a nod to Russian fairy tales.
 * Reuses MatryoshkaAvatar, the sled-glide keyframe (as `.carpet-glide`),
 * and khokhloma-petal wholesale. */
export default function MatryoshkaCarpetFlight() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="carpet-glide relative flex flex-col items-center" style={{ width: 100 }}>
        <span className="relative" style={{ width: 56, height: 56, marginBottom: -8 }}>
          <MatryoshkaAvatar id="matryoshka_laughing" size={56} />
        </span>

        <span className="relative rounded-md" style={{ width: 100, height: 16, background: CARPET_BASE }}>
          <span className="absolute inset-x-2 top-1/2 -translate-y-1/2" style={{ height: 2, background: CARPET_TRIM, opacity: 0.7 }} />
          {[0, 1, 2].map((i) => (
            <span key={i} className="khokhloma-petal absolute rounded-full" style={{ width: 8, height: 8, top: 4, left: 14 + i * 32, background: CARPET_TRIM, animationDelay: `${i * 0.1}s` }} />
          ))}
        </span>
      </div>
    </div>
  );
}
