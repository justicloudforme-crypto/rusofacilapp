"use client";

const FUR = "#8a5a3a";
const MUZZLE = "#e6c9a0";
const INK = "#241c15";

// Story beats:
//   Phase 1 (0.00–0.3s, `nap-flop`): the bear tips sideways and settles
//     into a curled heap in one motion — gave up instantly, no struggle.
//   Loop (0.3s onward, `zzz-drift`, staggered ×3): three little "z"s drift
//     up and to the side from the snout and fade, looping — fast asleep.
/** EVERYDAY-tier fail scenario: rather than sulk (see BearTossesUshanka),
 * this bear just decides the lesson can wait and takes a nap. Reuses the
 * same fur/muzzle palette as the rest of the bear cast, curled into a
 * single rounded heap instead of the standing pose. */
export default function SleepyBearNaps() {
  return (
    <div className="relative flex h-28 items-end justify-center" aria-hidden="true">
      <div className="nap-flop relative" style={{ width: 92, height: 56, transformOrigin: "50% 100%" }}>
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 72, height: 48, bottom: 0, background: FUR }} />
        <span className="absolute rounded-full" style={{ width: 16, aspectRatio: "1", bottom: 30, left: 4, background: FUR }} />
        <span className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ width: 26, height: 20, bottom: 12, left: "20%", background: MUZZLE }} />
        <span className="absolute rounded-t-full" style={{ width: 10, height: 3, bottom: 26, left: "24%", background: INK, opacity: 0.6 }} />
        <span className="absolute rounded-full" style={{ width: 4, height: 4, bottom: 20, left: "26%", background: INK }} />

        {[0, 0.55, 1.1].map((delay, i) => (
          <span
            key={i}
            className="zzz-drift absolute select-none text-xs font-bold"
            style={{ bottom: 34 + i * 2, left: `${8 - i * 2}%`, color: INK, opacity: 0.5, animationDelay: `${delay}s` }}
          >
            z
          </span>
        ))}
      </div>
    </div>
  );
}
