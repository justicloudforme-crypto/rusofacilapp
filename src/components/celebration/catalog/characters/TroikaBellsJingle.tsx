"use client";

const BELL = "#e0a934";
const BELL_DARK = "#8a6a1e";
const STRAP = "#5c3b26";

const BELLS = [0, 1, 2];

// Story beats:
//   Loop (0–0.5s, `bell-jingle-swing`, staggered ×3): three дуга bells
//     hanging off a harness strap swing side to side out of sync — a
//     jingle reads better as staggered swinging than uniform bouncing.
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×3 on their own
//     delay): a glint pops off each bell right as it swings widest.
/** STREAK-tier win scenario: a close-up on the troika harness bells
 * (бубенцы) — a smaller, punchier companion piece to TroikaSled.tsx's full
 * sled shot, reserved for a correct-answer streak. */
export default function TroikaBellsJingle() {
  return (
    <div className="relative flex h-28 items-start justify-center gap-3 pt-4" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", height: 6, top: 6, background: STRAP }} />
      {BELLS.map((i) => (
        <span
          key={i}
          className="bell-jingle-swing relative"
          style={{ width: 22, height: 40, transformOrigin: "50% 0%", animationDelay: `${i * 0.12}s` }}
        >
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 2, height: 12, top: 0, background: STRAP }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 20, height: 20, top: 10, background: BELL }}>
            <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 8, background: BELL_DARK }} />
          </span>
          <span
            className="sparkle-twinkle absolute select-none text-xs"
            style={{ top: 6, right: -6, animationDelay: `${0.2 + i * 0.12}s` }}
          >
            ✨
          </span>
        </span>
      ))}
    </div>
  );
}
