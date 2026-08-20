"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const TONGUE = "#d63b2f";

// Story beats:
//   Loop (0–2.4s, `snowflake-piece` reused, staggered ×5): flakes drift
//     down past his tilted-up face, same fall keyframe as every other
//     winter scenario.
//   Loop (0–0.5s, `tongue-catch`): his tongue flicks out and back in a
//     quick rhythm, timed to catch whatever's falling.
//   Loop (0–0.9s, `sparkle-twinkle` reused, on each catch): a glint marks
//     the moment a flake lands.
/** EVERYDAY-tier win scenario: a bear happily catching snowflakes on his
 * tongue. Same fur/ushanka vocabulary as the rest of the bear cast; head
 * tipped back instead of level. */
export default function MedvedSnowCatch() {
  return (
    <div className="relative flex h-28 items-center justify-center overflow-hidden" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="snowflake-piece absolute select-none text-white"
          style={{ left: `${10 + i * 20}%`, fontSize: 10, animationDelay: `${i * 0.4}s`, animationDuration: "2s" }}
        >
          ❄
        </span>
      ))}

      <div className="relative" style={{ width: 66, height: 66, transform: "rotate(-8deg)" }}>
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
          <span className="tongue-catch absolute left-1/2 -translate-x-1/2 rounded-b-full" style={{ width: "18%", height: "14%", top: "62%", background: TONGUE, transformOrigin: "50% 0%" }} />
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: "50%", left: "48%", animationDelay: "0.3s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
