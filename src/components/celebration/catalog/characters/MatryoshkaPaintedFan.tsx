"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FAN_BASE = "#d63b2f";
const FAN_TRIM = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.6s, `shawl-unfurl`-shaped bloom folded into
//     `fan-open`, one-shot): the fan opens from a closed sliver into a
//     full painted arc — same scale/rotate entrance curve as
//     catalog/patterns/Shawl.tsx's shawl bloom.
//   Loop (0.6s onward, same class): once open, it fans gently side to
//     side in front of her, cooling herself off after the win.
/** EVERYDAY-tier win scenario: a doll cooling herself with a painted
 * folding fan. Reuses MatryoshkaAvatar for the face; the fan's opening
 * curve matches Shawl.tsx's `shawl-unfurl` timing, combined with a
 * continuous sway in one `fan-open` class (two comma-separated animations
 * on the same shorthand — see MatryoshkaShawlTwirl.tsx for why that split
 * is needed instead of stacking two animation classes). */
export default function MatryoshkaPaintedFan() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 56, height: 56 }}>
        <MatryoshkaAvatar id="matryoshka_wink" size={56} />
      </div>

      <span className="fan-open relative" style={{ width: 46, height: 46, transformOrigin: "0% 100%" }}>
        <span className="absolute inset-0" style={{ background: FAN_BASE, clipPath: "polygon(0% 100%, 0% 60%, 100% 0%, 100% 30%)" }} />
        <span className="absolute inset-0" style={{ background: FAN_TRIM, opacity: 0.5, clipPath: "polygon(0% 100%, 0% 78%, 100% 12%, 100% 30%)" }} />
      </span>
    </div>
  );
}
