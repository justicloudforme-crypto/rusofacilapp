"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BELL = "#e0a934";
const BELL_DARK = "#8a6a1e";
const ROPE = "#c9962e";

// Story beats:
//   Loop (0–0.5s, `bell-jingle-swing` reused from TroikaBellsJingle.tsx):
//     the bell swings hard side to side on its rope — same motion, much
//     bigger bell.
//   Loop (0–0.9s, `sparkle-twinkle` reused, staggered ×2): glints pop off
//     the rim on each widest swing.
//   Loop (0–1.6s, `bear-bounce` reused): the bear underneath keeps up a
//     small triumphant bounce as he pulls the rope.
/** MILESTONE-tier win scenario: a bear ringing a large village bell — same
 * fur/ushanka vocabulary as the rest of the cast, reserved for a
 * level-up/exam/badge moment. Reuses the bell-swing keyframe from
 * catalog/characters/TroikaBellsJingle.tsx at a larger scale. */
export default function BearBellRinger() {
  return (
    <div className="relative flex h-32 items-end justify-center gap-2" aria-hidden="true">
      <span className="bell-jingle-swing relative" style={{ width: 40, height: 60, transformOrigin: "50% 0%" }}>
        <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 3, height: 16, top: 0, background: ROPE }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 38, height: 38, top: 14, background: BELL }}>
          <span className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: 14, background: BELL_DARK }} />
        </span>
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: 12, right: -10, animationDelay: "0.2s" }}>
          ✨
        </span>
        <span className="sparkle-twinkle absolute select-none text-xs" style={{ top: 30, left: -8, animationDelay: "0.55s" }}>
          ✨
        </span>
      </span>

      <div className="bear-bounce relative" style={{ width: 60, height: 60 }}>
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", left: "6%", background: FUR }} />
        <span className="absolute rounded-full" style={{ width: "22%", aspectRatio: "1", top: "4%", right: "6%", background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "70%", aspectRatio: "1", top: "10%", background: FUR }}>
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", left: "-6%", background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: "16%", height: "36%", top: "38%", right: "-6%", background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "84%", height: "12%", top: "16%", background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "80%", height: "32%", top: "-10%", background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "56%", height: "38%", top: "50%", background: MUZZLE }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", left: "27%", background: INK }} />
          <span className="absolute rounded-full" style={{ width: "9%", aspectRatio: "1", top: "42%", right: "27%", background: INK }} />
          <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: "13%", height: "9%", top: "56%", background: INK }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
