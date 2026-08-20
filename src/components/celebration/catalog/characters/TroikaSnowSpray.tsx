"use client";

import MatryoshkaAvatar from "@/components/avatars/MatryoshkaAvatar";

const SLED_WOOD = "#5c3b26";
const SLED_TRIM = "#e0a934";
const RUNNER = "#8a6a1e";

// Story beats:
//   Loop (0–0.5s, `sled-glide` reused from TroikaSled.tsx): the whole rig
//     rocks forward-and-back and bobs, same "moving fast" shorthand.
//   Loop (0–0.6s, `trail-streak` reused, staggered ×6 — twice as many as
//     TroikaSled's four): a wider spray of speed lines streams out behind
//     the runners, reading as kicked-up snow rather than plain motion
//     lines.
//   Loop (0–2.4s, `snowflake-piece` reused, staggered ×5): loose snow
//     drifts up and back from the spray, same falling-snow keyframe used
//     everywhere else in the catalog, just drifting past the sled instead
//     of down from the sky.
/** MILESTONE-tier win scenario: the TroikaSled dolls at full gallop,
 * kicking up a wide snow spray behind them — busier than the plain sled
 * shot, reserved for a level-up/exam/badge moment. Reuses sled-glide,
 * trail-streak, and snowflake-piece wholesale. */
export default function TroikaSnowSpray() {
  const trails = [0, 1, 2, 3, 4, 5];
  const flakes = [0, 1, 2, 3, 4];
  return (
    <div className="relative flex h-28 w-full max-w-[220px] items-end justify-center overflow-hidden" aria-hidden="true">
      {trails.map((i) => (
        <span
          key={i}
          className="trail-streak absolute"
          style={{ width: 18, height: 3, bottom: 10 + i * 5, right: "50%", background: "#f2ede3", borderRadius: 9999, animationDelay: `${i * 0.09}s` }}
        />
      ))}
      {flakes.map((i) => (
        <span
          key={i}
          className="snowflake-piece absolute select-none text-white"
          style={{ left: `${50 + i * 6}%`, top: `${40 + (i % 3) * 10}%`, fontSize: 8 + (i % 3) * 2, animationDelay: `${i * 0.3}s`, animationDuration: "1.6s" }}
        >
          ❄
        </span>
      ))}

      <div className="sled-glide relative" style={{ width: 130, height: 78 }}>
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-1">
          <MatryoshkaAvatar id="matryoshka_laughing" size={30} />
          <MatryoshkaAvatar id="matryoshka_happy" size={38} />
          <MatryoshkaAvatar id="matryoshka_proud" size={30} />
        </span>

        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-xl" style={{ width: 108, height: 14, background: SLED_WOOD }}>
          <span className="absolute inset-x-0 top-0" style={{ height: 4, background: SLED_TRIM }} />
        </span>
        <span
          className="absolute rounded-full"
          style={{ width: 118, height: 10, bottom: -6, left: "50%", transform: "translateX(-50%)", background: RUNNER, clipPath: "polygon(6% 0%, 100% 0%, 88% 100%, 0% 100%)" }}
        />
      </div>
    </div>
  );
}
