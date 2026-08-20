"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const HAT_FUR = "#3a2a20";
const HAT_TRIM = "#2a1d16";
const INK = "#241c15";
const SNOW = "#f2ede3";

// Story beats:
//   Phase 1 (0.00–0.35s, `bear-trip-lurch` reused from BearDropsPelmeni.tsx,
//     amplified with `nap-flop`'s settle): mid-march he pitches forward
//     and goes still, face-down — asleep before he even lands, unlike
//     BearWindBoomerang.tsx's startled topple.
//   Phase 2 (0.3–0.65s, `ushanka-toss` reused from BearTossesUshanka.tsx):
//     his own hat, knocked loose by the fall, arcs up and lands squarely
//     on the back of his head.
//   Loop (0.5s onward, `zzz-drift` reused from SleepyBearNaps.tsx,
//     staggered ×2): a couple of "z"s drift up from under the hat —
//     out cold.
/** EVERYDAY-tier fail scenario: the BearActiveMarch win, undone by
 * falling asleep mid-step. Reuses bear-trip-lurch, ushanka-toss, and
 * zzz-drift wholesale — only the snowbank silhouette below is new. */
export default function BearSleepFaceplant() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 80, height: 20, bottom: 0, background: SNOW }} />

      <div className="bear-trip-lurch relative" style={{ width: 90, height: 60, transformOrigin: "50% 100%" }}>
        <span className="ushanka-toss absolute left-1/2" style={{ top: "-6%", width: 34, height: 26, marginLeft: -17, transformOrigin: "50% 100%" }}>
          <span className="absolute rounded-b-full" style={{ width: 7, height: 13, top: 6, left: -3, background: HAT_FUR }} />
          <span className="absolute rounded-b-full" style={{ width: 7, height: 13, top: 6, right: -3, background: HAT_FUR }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 30, height: 6, top: 3, background: HAT_TRIM, borderRadius: 9999 }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ width: 26, height: 13, top: -5, background: HAT_FUR, borderRadius: "50% 50% 0 0" }} />
        </span>

        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 68, height: 44, bottom: 0, background: FUR }} />
        <span className="absolute rounded-full" style={{ width: 15, aspectRatio: "1", bottom: 26, left: 6, background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 24, height: 18, bottom: 10, left: "18%", background: MUZZLE }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 20, left: "24%", background: INK }} />

        {[0, 0.55].map((delay, i) => (
          <span key={i} className="zzz-drift absolute select-none text-xs font-bold" style={{ bottom: 30 + i * 2, left: `${6 - i * 2}%`, color: INK, opacity: 0.5, animationDelay: `${delay}s` }}>
            z
          </span>
        ))}
      </div>
    </div>
  );
}
