"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const FAN_BASE = "#d63b2f";
const FAN_TRIM = "#e0a934";

// Story beats:
//   Phase 1 (0.00–0.3s, `fan-snap-shut`, holds closed): instead of
//     MatryoshkaPaintedFan.tsx's smooth open-and-sway, the fan snaps shut
//     hard and lands flat against her face.
//   Loop (0.2s onward, `avatar-flinch` reused, on the doll): a single
//     startled flinch-back the instant it closes.
/** EVERYDAY-tier fail scenario: the MatryoshkaPaintedFan win, snapped shut
 * instead of gently fanning. Same fan-red/gold palette; reuses the
 * avatar-flinch keyframe wholesale for the reaction. */
export default function MatryoshkaFanSnap() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </span>

      <span className="fan-snap-shut relative" style={{ width: 46, height: 46, transformOrigin: "0% 100%" }}>
        <span className="absolute inset-0" style={{ background: FAN_BASE, clipPath: "polygon(0% 100%, 0% 60%, 100% 0%, 100% 30%)" }} />
        <span className="absolute inset-0" style={{ background: FAN_TRIM, opacity: 0.5, clipPath: "polygon(0% 100%, 0% 78%, 100% 12%, 100% 30%)" }} />
      </span>
    </div>
  );
}
