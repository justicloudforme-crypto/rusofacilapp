"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BURNT = "#3a2a20";

// Story beats:
//   Phase 1 (0.00–0.5s, `karavai-slump`, holds sunk): the loaf sinks and
//     darkens in place — the opposite of BearBakesKaravai's proud raise,
//     it never even leaves the tray.
//   Loop (0.3s onward, `smoke-puff` reused, staggered ×2): two puffs rise
//     off the crust, same shape as the balalaika/step-dust smoke reused
//     elsewhere in the catalog.
/** EVERYDAY-tier fail scenario: the BearBakesKaravai loaf, burnt instead
 * of golden. Same fur/ushanka vocabulary; the bread itself just goes
 * dark and collapses rather than leaving the tray. */
export default function BearKaravaiBurnt() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 88 }}>
        <span className="smoke-puff absolute rounded-full bg-white" style={{ width: 4, height: 14, left: "40%", top: -10, opacity: 0.55, animationDelay: "0s" }} />
        <span className="smoke-puff absolute rounded-full bg-white" style={{ width: 4, height: 12, left: "58%", top: -6, opacity: 0.45, animationDelay: "0.4s" }} />
        <span className="karavai-slump absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 34, height: 26, top: -12, background: BURNT }} />

        <div className="relative" style={{ width: 66, height: 66, marginTop: 22 }}>
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
            <span className="absolute left-1/2 -translate-x-1/2" style={{ width: "20%", height: "3px", top: "60%", background: INK, opacity: 0.6 }} />
          </span>
          <span className="absolute left-1/2 -translate-x-1/2 rounded-t-2xl" style={{ width: "70%", height: "34%", bottom: 0, background: FUR }} />
        </div>
      </div>
    </div>
  );
}
