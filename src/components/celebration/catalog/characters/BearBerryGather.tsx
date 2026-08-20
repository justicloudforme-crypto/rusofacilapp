"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const BASKET = "#c9962e";
const BASKET_DARK = "#8a6a1e";
const BERRY = "#d63b2f";
const BERRY_SHINE = "#e88a80";

// Story beats:
//   Loop (0–0.8s, `berry-bob` reused from Kalinka.tsx, staggered ×3): the
//     berries in his basket bob gently in place, same motion used for the
//     hanging kalinka cluster — settled, not spilling.
//   Loop (0–0.6s, `bear-pick-dip`): his free paw dips down toward the
//     bushes and back up, a neat, unhurried picking motion — the opposite
//     energy of BearVacuumOops.tsx's frantic inhale.
/** EVERYDAY-tier win scenario: a bear calmly, carefully picking forest
 * berries into a basket (лукошко). Same fur/ushanka vocabulary as the
 * rest of the bear cast; reuses berry-bob wholesale for the basket's
 * contents. */
export default function BearBerryGather() {
  return (
    <div className="relative flex h-28 items-end justify-center gap-1" aria-hidden="true">
      <div className="relative" style={{ width: 66, height: 66 }}>
        <span className="bear-pick-dip absolute rounded-full" style={{ width: 14, height: 22, top: "50%", left: "-10%", background: FUR, transformOrigin: "50% 0%" }} />
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

      <div className="relative" style={{ width: 40, height: 34 }}>
        <span className="absolute inset-x-0 bottom-0 rounded-b-2xl" style={{ height: 24, background: BASKET, clipPath: "polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)" }} />
        <span className="absolute inset-x-2" style={{ top: 10, height: 2, background: BASKET_DARK, opacity: 0.6 }} />
        {[0, 1, 2].map((i) => (
          <span key={i} className="berry-bob absolute rounded-full" style={{ width: 9, height: 9, top: -2, left: 6 + i * 10, background: BERRY, animationDelay: `${i * 0.1}s` }}>
            <span className="absolute rounded-full" style={{ width: 3, height: 3, top: 1, left: 1, background: BERRY_SHINE, opacity: 0.8 }} />
          </span>
        ))}
      </div>
    </div>
  );
}
