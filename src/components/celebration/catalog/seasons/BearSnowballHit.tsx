"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOWBALL = "#f2ede3";
const TARGET_OUTER = "#d63b2f";
const TARGET_INNER = "#e0a934";

// Story beats:
//   Loop (0–0.5s, `snowball-throw-arm` reused from RabbitSnowballToss.tsx):
//     the same pitching wind-up and release.
//   Loop (0–0.7s, `snowball-fly` reused, aimed at a fixed target instead
//     of fading off-frame): the snowball arcs across and lands square on
//     the bullseye.
//   Loop (0–0.9s, `sparkle-twinkle` reused, timed to the landing): a
//     shine marks a clean hit.
/** EVERYDAY-tier win scenario: a bear landing a snowball throw dead
 * center on a target — the bear-led companion to
 * RabbitSnowballToss.tsx, reusing its throw/fly keyframes wholesale. */
export default function BearSnowballHit() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-3" aria-hidden="true">
      <div className="relative" style={{ width: 60, height: 60 }}>
        <span className="snowball-fly absolute rounded-full" style={{ width: 10, height: 10, left: 40, top: 20, background: SNOWBALL, border: "1px solid rgba(0,0,0,0.08)" }} />

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

        <span className="snowball-throw-arm absolute rounded-full" style={{ width: 8, height: 18, right: 2, top: 22, background: FUR, transformOrigin: "50% 0%" }} />
      </div>

      <div className="relative rounded-full" style={{ width: 40, height: 40, background: TARGET_OUTER }}>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 24, height: 24, background: TARGET_INNER }} />
        <span className="sparkle-twinkle absolute select-none text-sm" style={{ top: -6, right: -6, animationDelay: "0.55s" }}>
          ✨
        </span>
      </div>
    </div>
  );
}
