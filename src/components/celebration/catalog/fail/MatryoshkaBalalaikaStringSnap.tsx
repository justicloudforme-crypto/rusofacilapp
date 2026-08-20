"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";

// Story beats:
//   Phase 1 (0.00–0.35s, `string-stretch`): the top string stretches
//     upward past its post, visibly overtightened — she's trying to play.
//   Phase 2 (0.35s, `string-snap-left` / `string-snap-right`): the string
//     splits into two halves that recoil apart and curl, each spinning
//     off in its own direction — the actual "snap".
//   Phase 3 (from 0.35s, `avatar-flinch`, on the doll herself): a single
//     startled flinch-back the instant it breaks.
/** EVERYDAY-tier fail scenario: earnest effort, undone by one dramatically
 * overtightened string. Reuses MatryoshkaAvatar (proven shapes) for the
 * doll and the same balalaika silhouette used across the win/streak music
 * scenarios, just held instead of strummed. */
export default function MatryoshkaBalalaikaStringSnap() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-3" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={56} />
      </span>

      <div className="relative" style={{ width: 44, height: 60 }}>
        <span className="absolute inset-x-0 bottom-0" style={{ height: 34, background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 8, height: 30, bottom: 30, background: NECK }} />

        {/* The one string that gives out. */}
        <span className="string-stretch absolute left-1/2 -translate-x-1/2" style={{ width: 2, height: 26, bottom: 12, background: STRING }} />
        <span className="string-snap-left absolute left-1/2" style={{ width: 2, height: 12, bottom: 30, marginLeft: -1, background: STRING, transformOrigin: "bottom" }} />
        <span className="string-snap-right absolute left-1/2" style={{ width: 2, height: 12, bottom: 30, marginLeft: -1, background: STRING, transformOrigin: "bottom" }} />

        {/* Two intact strings either side — only the middle one snapped. */}
        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 12, marginLeft: -8, background: STRING, opacity: 0.5 }} />
        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 12, marginLeft: 6, background: STRING, opacity: 0.5 }} />
      </div>
    </div>
  );
}
