"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";

// Story beats:
//   Loop (0–0.25s, `comic-shiver` reused from UshankaHides.tsx): a tight,
//     fast tremor — colder and more helpless than any of his other
//     mishaps, since this one has no punchline motion of its own, just
//     the shake.
//   Loop (0–0.4s, `sparkle-twinkle` reused, on the mouth): little sparks
//     flash where his chattering teeth meet.
//   Loop (0–1.8s, `steam-wisp` reused ×2, positioned at the ears instead
//     of a spout): steam puffs out from both ears — same rising-wisp
//     shape used for every samovar/banya scene in the catalog.
/** EVERYDAY-tier fail scenario: the bear shivering so hard his teeth spark
 * and steam comes out his ears. Reuses comic-shiver, sparkle-twinkle, and
 * steam-wisp wholesale — no new keyframes needed for this one. */
export default function BearShiverSmoke() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 14, left: "12%", top: 6, opacity: 0.55 }} />
      <span className="steam-wisp absolute rounded-full bg-white" style={{ width: 4, height: 14, right: "12%", top: 6, opacity: 0.55, animationDelay: "0.7s" }} />

      <div className="comic-shiver relative" style={{ width: 66, height: 66 }}>
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
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "22%", height: "6%", top: "60%", background: INK, opacity: 0.7 }} />
          <span className="sparkle-twinkle absolute select-none text-xs" style={{ top: "56%", left: "58%", animationDelay: "0.15s" }}>
            ✨
          </span>
        </span>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
      </div>
    </div>
  );
}
