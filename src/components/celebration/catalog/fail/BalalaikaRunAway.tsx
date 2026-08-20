"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const BODY = "#e0a934";
const NECK = "#5c3b26";
const STRING = "#fff8ec";
const LEG = "#3a2a20";
const SOUR = "#d63b2f";

// Story beats:
//   Phase 1 (0.00–0.3s, `sour-note-wobble` reused, holds visible): a
//     flat-note glyph wobbles above the neck — the wrong note that
//     starts everything.
//   Phase 2 (0.2–0.7s, `balalaika-scamper-off`, holds off-frame): four
//     tiny legs pop out from under the body and it scurries sideways off
//     the edge of the frame — the opposite of BalalaikaSerenadeStrum.tsx's
//     instrument staying put in its player's hands.
//   Loop (0.5s onward, `avatar-flinch` reused, on the doll left behind):
//     a single startled blink at the now-empty spot.
/** EVERYDAY-tier fail scenario: the BalalaikaSerenadeStrum win, ruined by
 * one sour note — the balalaika grows legs and runs off rather than
 * staying to be played. Reuses sour-note-wobble and avatar-flinch
 * wholesale. */
export default function BalalaikaRunAway() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-4 overflow-hidden" aria-hidden="true">
      <span className="avatar-flinch">
        <MatryoshkaAvatar id="matryoshka_surprised" size={52} />
      </span>

      <div className="balalaika-scamper-off relative" style={{ width: 44, height: 60 }}>
        <span className="sour-note-wobble absolute select-none text-sm font-bold" style={{ top: -14, left: "50%", marginLeft: -4, color: SOUR }}>
          ♭
        </span>
        <span className="absolute inset-x-0 bottom-2" style={{ height: 34, background: BODY, clipPath: "polygon(50% 0%, 8% 100%, 92% 100%)" }} />
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 8, height: 30, bottom: 32, background: NECK }} />
        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 14, marginLeft: -8, background: STRING, opacity: 0.5 }} />
        <span className="absolute left-1/2" style={{ width: 2, height: 26, bottom: 14, marginLeft: 6, background: STRING, opacity: 0.5 }} />

        <span className="absolute rounded-full" style={{ width: 3, height: 8, bottom: 0, left: 10, background: LEG }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 8, bottom: 0, left: 18, background: LEG }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 8, bottom: 0, right: 18, background: LEG }} />
        <span className="absolute rounded-full" style={{ width: 3, height: 8, bottom: 0, right: 10, background: LEG }} />
      </div>
    </div>
  );
}
