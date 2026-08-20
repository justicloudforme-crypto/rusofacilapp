"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const RIBBON = "#d63b2f";
const RIBBON_TRIM = "#e0a934";

// Story beats:
//   Loop (0–1.6s, `ribbon-coil-wrap`): instead of MatryoshkaRibbonDance's
//     five segments flowing in a wave, one long ribbon spirals inward and
//     cinches tight around her, then unwinds back out to start over —
//     tangled, not twirled.
/** EVERYDAY-tier fail scenario: the MatryoshkaRibbonDance win, wound up
 * instead of waved. Same ribbon-red/gold palette; reuses MatryoshkaAvatar's
 * "surprised" face for what peeks out between coils. */
export default function MatryoshkaRibbonTangle() {
  return (
    <div className="relative flex h-28 items-center justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
        <span
          className="ribbon-coil-wrap absolute rounded-full"
          style={{ inset: -4, border: `5px solid ${RIBBON}`, borderTopColor: RIBBON_TRIM }}
        />
      </div>
    </div>
  );
}
