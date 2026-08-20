"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BREAD = "#e0a934";
const BREAD_SHADE = "#c9962e";

// Story beats:
//   Loop (0–0.7s, `karavai-raise` — the same lift used for
//     RabbitCarrotVictory's carrot): the bear lifts the round loaf
//     overhead and back down in a small victory pump.
//   Loop (0–0.9s, `sparkle-twinkle` reused, delayed): a shine pops off the
//     crust each time it reaches the top of its raise.
/** EVERYDAY-tier win scenario: a bear presenting a fresh каравай (a round
 * decorated celebration loaf) — same fur/ushanka vocabulary as the rest of
 * the bear cast, new prop reusing the carrot-raise lift wholesale. */
export default function BearBakesKaravai() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 88 }}>
        <span className="karavai-raise absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 26, top: -16, background: BREAD, transformOrigin: "50% 100%" }}>
          <span className="absolute inset-x-2 top-2" style={{ height: 2, background: BREAD_SHADE, opacity: 0.7 }} />
          <span className="absolute inset-x-3 top-6" style={{ height: 2, background: BREAD_SHADE, opacity: 0.7 }} />
        </span>
        <span
          className="sparkle-twinkle absolute select-none text-sm"
          style={{ top: -22, left: "60%", animationDelay: "0.35s" }}
        >
          ✨
        </span>

        <div className="bear-bounce relative" style={{ width: 66, height: 66, marginTop: 22 }}>
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
    </div>
  );
}
