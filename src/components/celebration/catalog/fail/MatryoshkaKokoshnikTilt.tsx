"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const KOKOSHNIK = "#d63b2f";
const KOKOSHNIK_TRIM = "#e0a934";

// Story beats:
//   Loop (0–1.6s, `ushanka-pull-down` reused from UshankaHides.tsx): the
//     kokoshnik slides straight down over her whole face instead of
//     sitting proudly on top, same "the hat wins" motion regardless of
//     which headwear is involved.
//   Loop (0.35s onward, `comic-shiver` reused): once covered, she wobbles
//     in a tight, fast tremor trying to see again.
/** EVERYDAY-tier fail scenario: the MatryoshkaKokoshnikSparkle win,
 * slipped instead of gleaming. Same headdress vocabulary; reuses the
 * exact hides-under-headwear motion from catalog/fail/UshankaHides.tsx. */
export default function MatryoshkaKokoshnikTilt() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="comic-shiver relative" style={{ width: 60, height: 60 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={60} />
        <span
          className="ushanka-pull-down absolute left-1/2 -translate-x-1/2"
          style={{ top: -14, width: 46, height: 66 }}
        >
          <span className="absolute inset-x-0 top-0" style={{ height: 22, background: KOKOSHNIK, borderRadius: "50% 50% 0 0" }}>
            <span className="absolute inset-x-0 bottom-0" style={{ height: 5, background: KOKOSHNIK_TRIM }} />
          </span>
        </span>
      </div>
    </div>
  );
}
