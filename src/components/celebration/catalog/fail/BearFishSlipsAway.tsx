"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const ICE = "#c7dff0";
const HOLE = "#2d5f8a";
const FISH_BODY = "#e0a934";
const SPLASH = "#fff8ec";

// Story beats:
//   Phase 1 (0.00–0.4s, `fish-slip-away`, holds sunk): the fish that
//     almost made it out slips back down through the hole instead of
//     rising — the opposite trajectory of BearIceFishing's catch.
//   Phase 1 (0.1–0.5s, `splash-pop`, staggered ×3): a few splash droplets
//     pop up around the hole the instant the fish disappears.
/** EVERYDAY-tier fail scenario: the BearIceFishing catch getting away at
 * the last second. Same ice/hole/bear setup, opposite outcome. */
export default function BearFishSlipsAway() {
  const splashes = [0, 1, 2];
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 110, height: 92 }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 100, height: 18, bottom: 0, background: ICE }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 12, bottom: 4, background: HOLE }} />

        {splashes.map((i) => (
          <span
            key={i}
            className="splash-pop absolute rounded-full"
            style={{ width: 4, height: 4, bottom: 14, left: `${44 + i * 6}%`, background: SPLASH, animationDelay: `${0.1 + i * 0.08}s` }}
          />
        ))}
        <span className="fish-slip-away absolute left-1/2" style={{ bottom: 10, width: 20, height: 10, marginLeft: -8 }}>
          <span className="absolute rounded-full" style={{ width: 20, height: 10, background: FISH_BODY, clipPath: "polygon(0% 50%, 80% 0%, 100% 50%, 80% 100%)" }} />
        </span>

        <div className="relative" style={{ width: 66, height: 66, marginLeft: 16 }}>
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
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "24%", height: "3px", top: "58%", background: INK, opacity: 0.6 }} />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        </div>
      </div>
    </div>
  );
}
